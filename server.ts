import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import redis from './src/server/redis.js'; // Ensure correct extension for module resolution
import './src/server/workers/syllabusWorker.js'; // Initialize worker
import { getGemini, generateWithModelFallback, generateStreamWithModelFallback, cleanJsonString, generateFallbackCurriculum } from './src/server/ai.js';
import { generateTTS } from './src/server/services/tts.js';

dotenv.config();

function extractModulesFromIncompleteJSON(text: string) {
  const modules: any[] = [];
  const startIdx = text.indexOf('"curriculumModules"');
  if (startIdx === -1) return modules;
  
  let arrayStart = text.indexOf('[', startIdx);
  if (arrayStart === -1) return modules;
  
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && objStart !== -1) {
          const objStr = text.substring(objStart, i + 1);
          try {
            modules.push(JSON.parse(objStr));
          } catch (e) {}
          objStart = -1;
        }
      }
    }
  }
  return modules;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize BullMQ Queue
const curriculumQueue = new Queue('curriculum-generation', { connection: redis });


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/audio/:hash', async (req, res) => {
  const { hash } = req.params;
  try {
    const base64Audio = await redis.get(`tts:${hash}`);
    if (!base64Audio) {
      return res.status(404).send('Audio not found');
    }
    const buffer = Buffer.from(base64Audio, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Error retrieving audio');
  }
});

// 1. Generate Structured Lesson Plan with Visual Demonstration specs (SSE)
app.post('/api/generate-lesson', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Flush headers so client knows stream started
  res.flushHeaders?.();

  try {
    const {
      topic,
      materialText,
      level = 'beginner',
      durationMinutes = 5,
      language = 'English',
      style = 'analogies',
      teacherName = 'Elena Baranova',
      studentProfile,
    } = req.body;

    const ai = getGemini();

    if (ai) {
      const studentContext = studentProfile
        ? `Student Name: ${studentProfile.name || 'Learner'}, Current Mastery Level: ${studentProfile.level || level}, Weak Concepts to Address: ${(studentProfile.weakConcepts || []).join(', ') || 'None specified'}, Preferred Style: ${studentProfile.style || style}`
        : `Learner Level: ${level}, Preferred Style: ${style}`;

      const prompt = `You are ${teacherName}, an elite personalized AI Educator at EchoMind teaching an interactive video-based class.
Personalized Learner Profile:
${studentContext}
- Target Topic: ${topic || 'Understanding Core Concepts'}
- Uploaded Material/Notes: ${materialText ? materialText.slice(0, 3500) : 'None provided; teach topic dynamically and thoroughly from first principles'}
- Allocated Time: ${durationMinutes} minutes (Make the lesson short, brisk, and punchy!)
- Target Teaching Language: ${language}

=======================================================
TIMING & PACING MANDATE:
Keep the lesson concise, engaging, and fast-paced so the student learns quickly without boredom:
- For ${durationMinutes} minutes duration: generate ${durationMinutes <= 2 ? '2' : durationMinutes <= 5 ? '3' : '3-4'} modules.
- Every module "speechScript" MUST be 2 crisp, lively spoken sentences (about 25 to 45 words maximum) explaining the concept directly. No slow rambling, no repetitive pleasantries.
=======================================================

=======================================================
CRITICAL LANGUAGE MANDATE:
The learner has selected the language: "${language}".
You MUST generate ALL text content throughout the entire response ENTIRELY, FLUENTLY, AND NATIVELY in ${language}.
Specifically:
- "title": in ${language}
- "summary": in ${language}
- Every module "title": in ${language}
- Every module "speechScript": 2 crisp, lively spoken sentences in ${language}
- Every module "keyTakeaway": in ${language}
- "visualContent" ("title", "description", "details", "steps"): all in ${language}
- "checkpointQuestion" ("questionText", "options", "commonMisconception", "explanation"): all in ${language}
- "learningObjectives": in ${language}
- "finalAssessment" questions, options, conceptTested, hint: all in ${language}
- "recommendedNextTopics": in ${language}
DO NOT USE ENGLISH if "${language}" is not English. If Hindi, write natural conversational Hindi or Devanagari script. If Spanish, French, German, etc., write purely in that language.
=======================================================

Generate a fully personalized, pedagogical lesson plan formatted strictly as valid JSON matching this schema:
{
  "title": string,
  "summary": string,
  "subjectCategory": "physics" | "programming" | "math" | "biology" | "history" | "general",
  "estimatedTimeMinutes": number,
  "curriculumModules": [
    {
      "id": string,
      "title": string,
      "type": "explain" | "demonstrate" | "question" | "adapt",
      "speechScript": string,
      "keyTakeaway": string,
      "visualType": "equation" | "code" | "diagram" | "timeline" | "concept_map" | "interactive_sim",
      "visualContent": {
        "title": string,
        "description": string,
        "details": string[],
        "codeSnippet": string (optional code),
        "equations": string[] (optional math/physics formulas),
        "steps": string[]
      },
      "checkpointQuestion": {
        "questionText": string,
        "options": string[],
        "correctIndex": number,
        "commonMisconception": string,
        "explanation": string
      }
    }
  ],
  "learningObjectives": string[],
  "finalAssessment": [
    {
      "id": string,
      "question": string,
      "options": string[],
      "correctAnswer": number,
      "conceptTested": string,
      "hint": string
    }
  ],
  "recommendedNextTopics": string[]
}

Ensure the lesson follows human-like pedagogy: Understand -> Plan -> Explain -> Demonstrate -> Question -> Evaluate -> Adapt. Return ONLY the JSON.`;

      const stream = await generateStreamWithModelFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      let fullText = '';
      const processedModuleIds = new Set<string>();

      for await (const chunk of stream) {
        fullText += chunk.text;
        
        // Extract modules found so far
        const modules = extractModulesFromIncompleteJSON(fullText);
        for (const mod of modules) {
          if (!processedModuleIds.has(mod.id)) {
            processedModuleIds.add(mod.id);
            
            // 1. Check if speechScript exists
            if (mod.speechScript) {
              const hash = crypto.createHash('sha256').update(mod.speechScript).digest('hex');
              // 2. Check redis cache
              const cached = await redis.get(`tts:${hash}`);
              if (!cached) {
                // Generate and cache
                const audioBuffer = await generateTTS(mod.speechScript, language);
                if (audioBuffer) {
                  await redis.set(`tts:${hash}`, audioBuffer.toString('base64'));
                  mod.audioUrl = `/api/audio/${hash}`;
                }
              } else {
                mod.audioUrl = `/api/audio/${hash}`;
              }
            }

            // Emit the module
            res.write(`data: ${JSON.stringify({ type: 'module', data: mod })}\n\n`);
          }
        }
      }

      // At the end, try parsing the full text to emit the final metadata (title, summary, etc.)
      try {
        const parsed = JSON.parse(cleanJsonString(fullText));
        const metadata = { ...parsed };
        delete metadata.curriculumModules; // Already sent modules
        res.write(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`);
      } catch(e) {}

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      return res.end();
    }

    // High quality pedagogical fallback if Gemini API is not yet configured
    const fallback = generateFallbackLesson(topic, level, durationMinutes, language, teacherName);
    res.write(`data: ${JSON.stringify({ type: 'fallback', data: fallback })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    return res.end();
  } catch (error: any) {
    console.warn('Gemini lesson generation fallback triggered:', error?.message);
    const { topic, level, durationMinutes, language, teacherName } = req.body;
    const fallback = generateFallbackLesson(topic, level, durationMinutes, language, teacherName);
    res.write(`data: ${JSON.stringify({ type: 'fallback', data: fallback })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    return res.end();
  }
});

// 2. Misconception Detection & Adaptive Teaching Endpoint
app.post('/api/evaluate-answer', async (req, res) => {
  try {
    const {
      question,
      studentAnswer,
      concept,
      level = 'beginner',
      language = 'English',
      teacherName = 'Elena Baranova',
    } = req.body;

    const ai = getGemini();

    if (ai) {
      const prompt = `You are ${teacherName}, an empathetic and insightful AI educator at EchoMind.
A student was asked: "${question}"
Regarding concept: "${concept}"
The student answered: "${studentAnswer}"
Student level: ${level}
Target Language: ${language}

=======================================================
CRITICAL LANGUAGE MANDATE:
The learner has selected the language: "${language}".
You MUST write "feedback", "misconceptionDetected", "underlyingReason", "intuitiveAnalogy", "reExplanation", and "adaptedFollowupQuestion" entirely and fluently in ${language}.
=======================================================

Perform deep pedagogical misconception analysis. Evaluate if the student's answer is correct, partially correct, or reveals a fundamental misconception.
Provide an intuitive real-world analogy, clear encouraging feedback, and a targeted follow-up question in ${language}.

Format strictly as JSON:
{
  "isCorrect": boolean,
  "confidenceScore": number (0 to 100),
  "feedback": string,
  "misconceptionDetected": string or null,
  "underlyingReason": string,
  "intuitiveAnalogy": string,
  "reExplanation": string,
  "adaptedFollowupQuestion": {
    "questionText": string,
    "hint": string
  },
  "suggestedDifficultyAdjustment": "maintain" | "simplify" | "advance"
}
Return ONLY valid JSON.`;

      const response = await generateWithModelFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.5,
        },
      });

      const text = cleanJsonString(response.text?.trim() || '{}');
      const parsed = JSON.parse(text);
      return res.json({ success: true, evaluation: parsed });
    }

    // Fallback evaluation
    return res.json({
      success: true,
      fallback: true,
      evaluation: generateFallbackEvaluation(question, studentAnswer, concept, language),
    });
  } catch (error: any) {
    console.warn('Gemini answer evaluation fallback triggered:', error?.message);
    const { question, studentAnswer, concept, language } = req.body;
    return res.json({
      success: true,
      fallback: true,
      evaluation: generateFallbackEvaluation(question, studentAnswer, concept, language),
    });
  }
});

// 3. Ask Teacher mid-lesson
app.post('/api/ask-teacher', async (req, res) => {
  try {
    const {
      question,
      currentTopic,
      currentModule,
      language = 'English',
      teacherName = 'Elena Baranova',
    } = req.body;
    const ai = getGemini();

    if (ai) {
      const prompt = `You are ${teacherName}, a personal AI teacher in an active video lesson.
Current Topic: ${currentTopic}
Current Module: ${currentModule?.title || ''}
Student asked during lesson: "${question}"
Target Language: ${language}

CRITICAL: Respond in ${language} with teacherly clarity, precision, and warmth (2-4 sentences suitable for spoken video avatar). Return JSON:
{
  "answerScript": string (spoken reply strictly in ${language}),
  "quickTip": string (key takeaway in ${language}),
  "visualClue": string (visual reference in ${language})
}`;

      const response = await generateWithModelFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = cleanJsonString(response.text?.trim() || '{}');
      return res.json({ success: true, response: JSON.parse(text) });
    }

    return res.json({
      success: true,
      response: {
        answerScript: `Great question! When we examine ${currentTopic || 'this concept'}, the key principle is observing how cause directly determines effect. Let us connect this back to our current slide!`,
        quickTip: `Remember to anchor yourself to the core formula or rule before calculating edge cases.`,
        visualClue: `Notice the highlighted indicator on the demonstration board.`,
      },
    });
  } catch (err: any) {
    return res.json({
      success: true,
      response: {
        answerScript: `That is a thoughtful point. Always inspect how the inputs transform as they flow through the system.`,
        quickTip: `Focus on the relationship between the variables.`,
        visualClue: `Check the primary diagram step.`,
      },
    });
  }
});

// 4. Personalized AI Curriculum Generation Endpoint (No hardcoded paths)
app.post('/api/generate-curriculum', async (req, res) => {
  try {
    const payload = req.body;
    
    // Generate a deterministic hash for cache/job ID
    const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const cacheKey = `curriculum:${hash}`;

    // Check Redis for cached result
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      return res.json({ success: true, curriculum: JSON.parse(cachedResult), cached: true });
    }

    // Add job to BullMQ
    const job = await curriculumQueue.add('generate', payload, { jobId: hash });

    return res.json({ success: true, jobId: job.id });
  } catch (err: any) {
    console.warn('Curriculum job enqueue failed:', err?.message);
    const { subjectGoal, level, language, weeklyHours } = req.body;
    return res.json({
      success: true,
      fallback: true,
      curriculum: generateFallbackCurriculum(subjectGoal, level, language, weeklyHours),
    });
  }
});

app.get('/api/curriculum-job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await curriculumQueue.getJob(id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const state = await job.getState();

    if (state === 'completed') {
      const curriculum = job.returnvalue;
      // Cache the result in Redis for 24 hours
      await redis.set(`curriculum:${id}`, JSON.stringify(curriculum), 'EX', 86400);
      return res.json({ success: true, status: state, curriculum });
    }

    if (state === 'failed') {
      return res.json({ success: false, status: state, error: job.failedReason });
    }

    return res.json({ success: true, status: state });
  } catch (err: any) {
    console.error('Error fetching job status:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 5. Adaptive AI Practice Challenge Generator
app.post('/api/generate-practice', async (req, res) => {
  try {
    const {
      topic,
      level = 'intermediate',
      language = 'English',
      conceptToTest = '',
      teacherName = 'Oleg Kravtsov',
    } = req.body;

    const ai = getGemini();

    if (ai) {
      const prompt = `You are ${teacherName}, an adaptive diagnostic AI educator.
Generate an original, high-cognitive-depth practice question to diagnose student comprehension and common misconceptions for:
- Topic: ${topic}
- Level: ${level}
- Target Concept: ${conceptToTest || 'Core governing mechanism'}
- Language: ${language}

CRITICAL: Output must be 100% in ${language}.
Format strictly as JSON:
{
  "id": string,
  "question": string,
  "scenario": string (vivid real-world problem or thought experiment),
  "options": string[] (4 distinct choices where incorrect choices represent classic misconceptions),
  "correctIndex": number,
  "misconceptionAnalysis": {
    "correctReason": string,
    "distractorExplanations": string[] (explanation of why each wrong option was tempting)
  },
  "hint": string,
  "relatedConcept": string
}
Return ONLY valid JSON.`;

      const response = await generateWithModelFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      });

      const text = cleanJsonString(response.text?.trim() || '{}');
      return res.json({ success: true, practice: JSON.parse(text) });
    }

    return res.json({
      success: true,
      fallback: true,
      practice: generateFallbackPractice(topic, level, language, conceptToTest),
    });
  } catch (err: any) {
    console.warn('Practice generation fallback triggered:', err?.message);
    const { topic, level, language, conceptToTest } = req.body;
    return res.json({
      success: true,
      fallback: true,
      practice: generateFallbackPractice(topic, level, language, conceptToTest),
    });
  }
});

// Dynamic curriculum fallback generator supporting multilingual requests
// Fallback curriculum logic moved to ai.ts

// --- Postgres Database Endpoints ---

app.get('/api/lessons', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const dbLessons = await prisma.lesson.findMany({
      where: { userId: String(userId) },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map db structure to frontend SavedLessonRecord format
    const lessons = dbLessons.map(dbLesson => {
      const parsedModules: any = dbLesson.modules || {};
      return {
        id: dbLesson.id,
        topic: dbLesson.topic,
        title: dbLesson.title,
        teacherName: parsedModules.teacherName || dbLesson.teacherId,
        teacherAvatarUrl: parsedModules.teacherAvatarUrl || '',
        language: dbLesson.language,
        level: parsedModules.level || 'intermediate',
        date: dbLesson.createdAt.toLocaleDateString(),
        completed: parsedModules.completed || false,
        score: parsedModules.score,
        lesson: parsedModules.lesson || parsedModules
      };
    });
    
    res.json({ success: true, lessons });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/lessons', async (req, res) => {
  try {
    const { userId, title, topic, subjectCategory, teacherName, language, estimatedMinutes, ...rest } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    
    // Make sure user exists
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          fullName: 'Student',
          preferredLanguage: language || 'English'
        }
      });
    }

    const savedLesson = await prisma.lesson.create({
      data: {
        userId,
        title: title || rest.lesson?.title || topic || 'Lesson',
        topic: topic || 'Topic',
        subjectCategory: subjectCategory || rest.lesson?.subjectCategory || 'general',
        teacherId: teacherName || 'Elena Baranova',
        language: language || 'English',
        estimatedMinutes: estimatedMinutes || rest.lesson?.estimatedTimeMinutes || 20,
        modules: rest // Store all extra fields like lesson plan, teacherAvatarUrl, level in the JSON blob
      }
    });
    res.json({ success: true, lesson: savedLesson });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/profile', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const profile = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (profile) {
      res.json({ success: true, profile });
    } else {
      res.status(404).json({ success: false, error: 'Profile not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const { userId, ...updates } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
       user = await prisma.user.create({
         data: {
           id: userId,
           email: `${userId}@example.com`,
           fullName: updates.fullName || updates.name || 'Student',
           ...updates
         }
       });
       return res.json({ success: true, profile: user });
    }

    const updatedProfile = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: updates.fullName || updates.name,
        masteryLevel: updates.masteryLevel || updates.level,
        preferredLanguage: updates.preferredLanguage,
        preferredTeacherId: updates.preferredTeacherId
      }
    });
    res.json({ success: true, profile: updatedProfile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Fallback Generators ---

// Dynamic practice question fallback generator
function generateFallbackPractice(
  topic: string = 'Core Principles',
  level: string = 'intermediate',
  language: string = 'English',
  conceptToTest: string = ''
) {
  const isHindi = language.toLowerCase().includes('hindi') || language.toLowerCase().includes('hinglish');
  const cleanTopic = topic || 'System Dynamics';

  if (isHindi) {
    return {
      id: 'pract-fallback-hi',
      question: `${cleanTopic} ke sandarbh me, input parivartan aur output pratikriya ke beech ka sambandh kis niyam dwara nirdharit hota hai?`,
      scenario: `${cleanTopic} ki sthir sthiti me achanak hone wale parivartan ka anuman lagaiye.`,
      options: [
        `Pranali ke mool transfer function aur niyamit sanrakshan niyam dwara`,
        `Bina kisi niyam ke aakasmik aur anishchit parivartano dwara`,
        `Pranali bina kisi pratikriya ke turant shunya ho jati hai`,
        `Input se output ka koi bhi lena-dena nahi hota`
      ],
      correctIndex: 0,
      misconceptionAnalysis: {
        correctReason: `Sabhi bhautik, ganeetiya aur computer praniyan nishchit transfer functions aur santulan niyamo par kaam karti hain.`,
        distractorExplanations: [
          `Sahi uttar.`,
          `Jatilata ko poori tarah se anishchittata samajhne ki bhool.`,
          `Yeh manna ki har pranali parivartan par nasht ho jati hai.`,
          `Urja sanrakshan aur karya-karan ke niyam ka ullanghan.`
        ]
      },
      hint: `Sochiye ki kaise niyam aur sanrakshan pranali ko nirdharit karte hain.`,
      relatedConcept: `${cleanTopic} Santulan aur Pratikriya Niyam`
    };
  }

  return {
    id: 'pract-fallback-en',
    question: `In the study of ${cleanTopic}, what directly governs the relationship between an input change and the resulting system response?`,
    scenario: `Consider a system at steady-state equilibrium experiencing an external perturbation or parameter adjustment in ${cleanTopic}.`,
    options: [
      `The governing transfer functions and fundamental conservation laws of the system`,
      `Completely random uncoordinated fluctuations with zero measurable correlation`,
      `The system immediately collapses into permanent zero state`,
      `Response magnitude is completely independent of input energy`
    ],
    correctIndex: 0,
    misconceptionAnalysis: {
      correctReason: `All physical, mathematical, and computational systems operate according to defined transfer functions and equilibrium laws.`,
      distractorExplanations: [
        `Correct answer: Transfer functions mathematically dictate input-output relationships.`,
        `Classic distractor: Mistaking complex or non-linear behavior for true randomness.`,
        `Assuming all systems fail catastrophically under perturbation without damping.`,
        `Violating energy conservation and causality principles.`
      ]
    },
    hint: `Think about how conservation laws and governing equations constrain system transformations.`,
    relatedConcept: `${cleanTopic} Equilibrium & Transfer Mechanics`
  };
}

// Helper: robust pedagogical fallback generator
function generateFallbackLesson(topic: string = 'Ohm\'s Law & Electrical Circuits', level: string = 'beginner', duration: number = 20, language: string = 'English', teacherName: string = 'Andrei Baranov') {
  const isHindi = language.toLowerCase().includes('hindi') || language.toLowerCase().includes('hinglish');
  const isCode = topic.toLowerCase().includes('react') || topic.toLowerCase().includes('code') || topic.toLowerCase().includes('programming');
  const isPhysics = topic.toLowerCase().includes('ohm') || topic.toLowerCase().includes('physics') || topic.toLowerCase().includes('circuit') || topic.toLowerCase().includes('newton');

  if (isCode) {
    return {
      title: `Modern React & State Architecture`,
      summary: `Master reactive state transformations, unidirectional data flow, and component lifecycle with hands-on code examples.`,
      subjectCategory: 'programming',
      estimatedTimeMinutes: duration,
      learningObjectives: [
        'Understand component re-renders vs side effects',
        'Master useState and immutability rules',
        'Debug state desynchronization in real time'
      ],
      curriculumModules: [
        {
          id: 'mod-1',
          title: 'Foundations: The Declarative Paradigm',
          type: 'explain',
          speechScript: isHindi
            ? 'Namaste! Aaj hum React ka core concept samjhenge: UI state ka direct reflection hoti hai. Jab bhi state badalegi, React automatically UI ko refresh karega.'
            : 'Welcome! Today we will break down React state. In declarative UI, you describe what the interface should look like for a given state, and React handles the DOM updates.',
          keyTakeaway: 'UI = f(State): Views are pure projections of application memory.',
          visualType: 'code',
          visualContent: {
            title: 'Declarative State Hook',
            description: 'Counter Component demonstrating state updater function',
            details: [
              'Calling setCount triggers a schedule re-render',
              'Never mutate state directly (count++)',
              'Pass functional updaters for concurrent safety'
            ],
            codeSnippet: `function Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(prev => prev + 1)}>\n      Clicks: {count}\n    </button>\n  );\n}`,
            steps: ['Initial render: count = 0', 'User clicks button', 'setCount schedules re-render', 'React diffs virtual DOM & commits changes']
          },
          checkpointQuestion: {
            questionText: 'What happens if you execute `count = count + 1` directly without using setCount?',
            options: [
              'React re-renders immediately with the new value',
              'The count variable updates in memory, but React will NOT re-render the UI',
              'A compile-time syntax error is thrown',
              'The component resets back to 0'
            ],
            correctIndex: 1,
            commonMisconception: 'Assuming that modifying a JavaScript variable will automatically trigger DOM updates in React.',
            explanation: 'React needs state updater functions to intercept the change and trigger a reconciliation pass. Direct mutation is invisible to React.'
          }
        },
        {
          id: 'mod-2',
          title: 'Live Demonstration: Unidirectional Data Flow',
          type: 'demonstrate',
          speechScript: isHindi
            ? 'Chaliye execution flow dekhte hain. Parent component data niche pass karta hai props ke zariye, aur events upar emit hote hain.'
            : 'Let us visualize the data flow. Data cascades downwards via props, while user interactions bubble upwards via callbacks.',
          keyTakeaway: 'Props drill downwards, state mutations trigger upwards.',
          visualType: 'concept_map',
          visualContent: {
            title: 'Unidirectional Data Cascade',
            description: 'Parent -> Child Prop Hierarchy with event bubbling',
            details: [
              'Single source of truth prevents synchronization bugs',
              'Controlled components reflect state with zero latency',
              'Pure functions guarantee deterministic output'
            ],
            steps: ['State resides in parent container', 'Child receives data as immutable prop', 'Child fires callback on interaction', 'Parent handler dispatches state update']
          },
          checkpointQuestion: {
            questionText: 'Why should props never be modified inside a child component?',
            options: [
              'Because props are frozen and read-only by design in React',
              'Because JavaScript does not allow passing objects',
              'Because child components do not have memory',
              'It causes browser tabs to crash instantly'
            ],
            correctIndex: 0,
            commonMisconception: 'Treating props like mutable local variables inside child components.',
            explanation: 'Props represent external input owned by the parent. Modifying them violates the single source of truth.'
          }
        },
        {
          id: 'mod-3',
          title: 'Misconception Trap: State Batching & Async Updates',
          type: 'adapt',
          speechScript: isHindi
            ? 'Ek bohot common mistake: setState call karne ke turant baad console.log me naya state nahi milta, kyunki React updates ko batch karta hai.'
            : 'Here is an area where many developers stumble: React state updates are asynchronous and batched. Inspecting state immediately after calling its setter still returns the previous value.',
          keyTakeaway: 'State updates are batched for performance; use updater functions for dependent state.',
          visualType: 'code',
          visualContent: {
            title: 'Batching Demonstration',
            description: 'Comparing synchronous inspection vs functional updaters',
            details: [
              'React batches multiple setState calls within event handlers',
              'Prevents unnecessary intermediate render passes',
              'Use prev => prev + 1 when depending on previous state'
            ],
            codeSnippet: `// ❌ Incorrect assumption:\nsetCount(count + 1);\nconsole.log(count); // Still prints old count!\n\n// ✅ Correct updater pattern:\nsetCount(prev => prev + 1);`,
            steps: ['Call 1 scheduled', 'Call 2 scheduled', 'Event handler completes', 'React merges updates in single render batch']
          },
          checkpointQuestion: {
            questionText: 'If you call `setCount(count + 1)` three times synchronously in one handler, by how much does count increase?',
            options: [
              'Increases by 3',
              'Increases by only 1, because all three calls read the same snapshot of count',
              'Throws an infinite loop error',
              'Increases by 0'
            ],
            correctIndex: 1,
            commonMisconception: 'Thinking multiple setState(count + 1) calls accumulate during the same render pass without an updater function.',
            explanation: 'Each call evaluates with the static snapshot value of count from that render pass. To increment by 3, you must use setCount(p => p + 1).'
          }
        }
      ],
      finalAssessment: [
        {
          id: 'q1',
          question: 'What is the primary benefit of React\'s virtual DOM?',
          options: ['It replaces HTML entirely', 'It calculates minimal DOM changes via reconciliation', 'It allows running Python inside React', 'It makes CSS render faster'],
          correctAnswer: 1,
          conceptTested: 'Virtual DOM & Reconciliation',
          hint: 'Think about minimizing expensive real browser layout recalculations.'
        },
        {
          id: 'q2',
          question: 'When should you pass a function to useState\'s setter: `setCount(prev => prev + 1)`?',
          options: ['Always, it is mandatory', 'Whenever the new state depends on the previous state', 'Only in server-side rendering', 'Only when working with strings'],
          correctAnswer: 1,
          conceptTested: 'Functional State Updates',
          hint: 'Consider race conditions and batched execution.'
        }
      ],
      recommendedNextTopics: ['React useEffect & Lifecycle Management', 'Custom Hooks Architecture', 'Zustand & Global State Stores']
    };
  }

  if (isPhysics || (!isCode && (!topic || topic.toLowerCase().includes('ohm') || topic.toLowerCase().includes('circuit')))) {
    // Default Physics / Ohm's Law lesson (Matches exact hackathon problem statement)
    return {
      title: `Ohm's Law & Electric Current Fundamentals`,
      summary: `Deep dive into the fundamental relationship connecting Voltage, Current, and Resistance (V = I · R) with adaptive misconception detection.`,
      subjectCategory: 'physics',
      estimatedTimeMinutes: duration,
      learningObjectives: [
        'Master the governing equation V = I · R',
        'Distinguish potential difference from electrical current',
        'Understand the hydraulic water pipe analogy for resistance',
        'Predict circuit behavior under changing loads'
      ],
      curriculumModules: [
        {
          id: 'mod-1',
          title: 'Core Concept: Voltage as the Driving Force',
          type: 'explain',
          speechScript: isHindi
            ? 'Swagat hai dosto! Aaj hum physics ka ek sabse basic aur powerful law samjhenge: Ohm ka niyam. Voltage ek dhakka hai, jo electrons ko wire ke andar aage badhata hai.'
            : 'Welcome to EchoMind Physics! Today we will break down Ohm\'s Law. Think of Voltage as electrical pressure—the force pushing electrons through a conductive pathway.',
          keyTakeaway: 'Voltage (V) = The electric potential difference driving charges.',
          visualType: 'equation',
          visualContent: {
            title: 'Ohm\'s Fundamental Formula',
            description: 'The Golden Triangle of Electrical Engineering',
            equations: ['V = I \\times R', 'I = \\frac{V}{R}', 'R = \\frac{V}{I}'],
            details: [
              'V (Voltage) measured in Volts (V) — Electrical pressure',
              'I (Current) measured in Amperes (A) — Rate of electron flow',
              'R (Resistance) measured in Ohms (Ω) — Opposition to charge flow'
            ],
            steps: ['Battery establishes chemical potential difference', 'Free electrons in conductor experience electrostatic force', 'Uniform net drift velocity develops along circuit']
          },
          checkpointQuestion: {
            questionText: 'If Voltage is doubled while Resistance remains completely fixed, what happens to Current?',
            options: [
              'Current is halved',
              'Current also doubles',
              'Current stays exactly the same',
              'Current drops to zero'
            ],
            correctIndex: 1,
            commonMisconception: 'Confusing the direct proportionality between V and I with inverse proportionality.',
            explanation: 'Since I = V / R, Current is directly proportional to Voltage. Doubling the driving pressure doubles the flow of charge.'
          }
        },
        {
          id: 'mod-2',
          title: 'Visual Demonstration: The Water Pipe Analogy',
          type: 'demonstrate',
          speechScript: isHindi
            ? 'Isko paani ke pipe se socho: Voltage paani ki tanki ki unchai hai. Current paani ki dhaar hai. Aur Resistance pipe ka patla hona hai.'
            : 'Let us use a vivid analogy: Imagine a water pipe. Voltage is the water pressure pump. Current is the volume of water flowing per second. Resistance is narrowing the pipe.',
          keyTakeaway: 'Higher resistance restricts flow; higher voltage forces more flow.',
          visualType: 'interactive_sim',
          visualContent: {
            title: 'Hydraulic Circuit Model',
            description: 'Interactive visualization of Voltage pump, Resistance constriction, and Current flow rate',
            details: [
              'Pressure Pump = Battery (Voltage)',
              'Water Flow = Amperage (Current)',
              'Constricted Valve = Resistor (Resistance in Ohms)'
            ],
            steps: [
              'Wide pipe allows smooth, high-volume flow',
              'Squeezing the pipe increases friction (Resistance)',
              'For constant pressure, flow rate (Current) decreases'
            ]
          },
          checkpointQuestion: {
            questionText: 'What happens to Current (I) if Resistance (R) increases while Voltage (V) remains constant?',
            options: [
              'Current increases',
              'Current decreases',
              'Current fluctuates rapidly',
              'Current remains constant'
            ],
            correctIndex: 1,
            commonMisconception: 'Thinking that more resistance somehow forces more current through.',
            explanation: 'Resistance opposes charge flow. If you increase the opposition while keeping the push constant, fewer electrons pass per second (I decreases).'
          }
        },
        {
          id: 'mod-3',
          title: 'Adaptive Checkpoint: Circuit Problem Solving',
          type: 'adapt',
          speechScript: isHindi
            ? 'Ab ek practical sawal lagate hain. Agar humare paas 12 Volt ki battery hai aur 4 Ohm ka resistor hai, toh circuit me kitna current daudega?'
            : 'Now let us test our understanding with a real calculation. If you connect a 12 Volt power source across a 4 Ohm precision resistor, what is the resulting current?',
          keyTakeaway: 'Apply I = V / R with exact SI units.',
          visualType: 'equation',
          visualContent: {
            title: 'Direct Calculation Walkthrough',
            description: 'Step-by-step mathematical substitution',
            equations: ['Given: V = 12V, R = 4\\Omega', 'Formula: I = \\frac{V}{R}', 'Calculation: I = \\frac{12}{4} = 3\\text{ Amperes}'],
            details: [
              'Always verify units before calculating',
              'Resulting heat dissipation: P = I²R = (3)² × 4 = 36 Watts'
            ],
            steps: ['Identify knowns: V = 12V, R = 4Ω', 'Isolate unknown: I = V / R', 'Substitute & solve: I = 3A']
          },
          checkpointQuestion: {
            questionText: 'With 12V and 4Ω, the current through the circuit is:',
            options: [
              '48 Amperes',
              '3 Amperes',
              '0.33 Amperes',
              '16 Amperes'
            ],
            correctIndex: 1,
            commonMisconception: 'Multiplying V × R instead of dividing V / R.',
            explanation: 'Current is I = V / R = 12 / 4 = 3 Amperes. Multiplying 12 × 4 gives 48, which is mathematically inverted.'
          }
        }
      ],
      finalAssessment: [
        {
          id: 'q1',
          question: 'Which of the following units measures electrical Resistance?',
          options: ['Volts', 'Amperes', 'Ohms (Ω)', 'Watts'],
          correctAnswer: 2,
          conceptTested: 'Electrical Units',
          hint: 'Named after the German physicist Georg Ohm.'
        },
        {
          id: 'q2',
          question: 'In a home lighting circuit at fixed 220V, why does a higher-wattage bulb draw MORE current?',
          options: [
            'Because its filament has LOWER resistance (I = V / R)',
            'Because its filament has infinite resistance',
            'Because voltage increases inside the bulb',
            'Because electricity speeds up'
          ],
          correctAnswer: 0,
          conceptTested: 'Power & Resistance Interplay',
          hint: 'Lower resistance allows more charge to flow under constant line voltage.'
        },
        {
          id: 'q3',
          question: 'If you want to reduce current in a circuit by half without changing the power supply, you should:',
          options: [
            'Double the resistance',
            'Halve the resistance',
            'Disconnect the ground wire',
            'Add a higher voltage battery'
          ],
          correctAnswer: 0,
          conceptTested: 'Proportional Reasoning in Ohm\'s Law',
          hint: 'I and R are inversely proportional.'
        }
      ],
      recommendedNextTopics: ['Kirchhoff\'s Current and Voltage Laws', 'Parallel vs Series Resistor Networks', 'AC Circuits & Impedance']
    };
  }

  // Dynamic tailored curriculum for any other custom subject
  const cleanTopic = topic || 'Core Subject Fundamentals';
  return {
    title: `${cleanTopic}: Core Principles & Mastery`,
    summary: `A structured conceptual breakdown of ${cleanTopic}, examining core mechanisms, real-world analogies, and hands-on problem solving.`,
    subjectCategory: 'general',
    estimatedTimeMinutes: duration,
    learningObjectives: [
      `Understand fundamental principles governing ${cleanTopic}`,
      `Analyze key relationships and cause-effect interactions`,
      `Apply conceptual knowledge to solve practical scenarios`
    ],
    curriculumModules: [
      {
        id: 'mod-1',
        title: `Foundations: What is ${cleanTopic}?`,
        type: 'explain',
        speechScript: isHindi
          ? `Namaste! Aaj hum ${cleanTopic} ke mukhya siddhant samjhenge. Kisi bhi vishay ko samajhne ke liye uski neenv mazboot hona sabse zaroori hai.`
          : `Welcome! Today we will break down ${cleanTopic}. To master this subject, we first establish the foundational laws that govern how it operates.`,
        keyTakeaway: `Mastering fundamentals provides the framework for all advanced analysis in ${cleanTopic}.`,
        visualType: 'concept_map',
        visualContent: {
          title: `Core Conceptual Map: ${cleanTopic}`,
          description: `Structural overview of fundamental building blocks and relationships`,
          details: [
            `Primary definition and domain scope of ${cleanTopic}`,
            `Key variables, driving forces, and environmental factors`,
            `Essential conservation and balance principles`
          ],
          steps: [
            `Identify primary inputs and boundary conditions`,
            `Map transformational pathways through the system`,
            `Evaluate steady-state outputs and equilibrium`
          ]
        },
        checkpointQuestion: {
          questionText: `What is the most critical first step when analyzing ${cleanTopic}?`,
          options: [
            `Isolate the core variables and establish boundary conditions`,
            `Memorize surface formulas without understanding relationships`,
            `Assume all variables remain random and unmeasurable`,
            `Skip foundational definitions directly to advanced edge cases`
          ],
          correctIndex: 0,
          commonMisconception: `Trying to solve complex problems without identifying the basic governing variables first.`,
          explanation: `Systematic analysis always begins by isolating known inputs, boundary constraints, and core governing relationships.`
        }
      },
      {
        id: 'mod-2',
        title: `Demonstration: Dynamics & Real-World Analogy`,
        type: 'demonstrate',
        speechScript: isHindi
          ? `Chaliye isko ek practical udaharan se dekhte hain. Jab hum iske prabhav ko observe karte hain, toh cause and effect ka sambandh saaf dikhta hai.`
          : `Let us ground this in a real-world demonstration. Notice how shifting the primary variable creates a direct, measurable cascade through the entire system.`,
        keyTakeaway: `System behavior is deterministic: input adjustments yield predictable output transformations.`,
        visualType: 'diagram',
        visualContent: {
          title: `System Dynamic Flow`,
          description: `Visualizing input-to-output transformation and feedback loops`,
          details: [
            `Primary stimulus / driving factor initiation`,
            `Intermediate transformation mechanisms`,
            `Observable output responses and stabilization`
          ],
          steps: [
            `Initial equilibrium state`,
            `Perturbation applied to driving variable`,
            `System responds to restore equilibrium or reach new steady state`
          ]
        },
        checkpointQuestion: {
          questionText: `When a primary input variable is increased in this system, what typically governs the response?`,
          options: [
            `The intrinsic proportionality and transfer function of the system`,
            `Completely random fluctuations with zero correlation`,
            `The system permanently breaks without any reaction`,
            `Outputs always decrease to zero regardless of inputs`
          ],
          correctIndex: 0,
          commonMisconception: `Assuming complex systems have unpredictable or disconnected responses.`,
          explanation: `All physical, mathematical, and algorithmic systems respond according to defined transfer functions and proportionality rules.`
        }
      },
      {
        id: 'mod-3',
        title: `Synthesis & Practical Problem Solving`,
        type: 'adapt',
        speechScript: isHindi
          ? `Ab chaliye ek practical scenario solve karte hain. Jo concepts humne sikhe hain, unhe apply karke dekhte hain.`
          : `Now let us put theory into practice with a diagnostic challenge. We will apply the principles we covered to solve a realistic scenario.`,
        keyTakeaway: `True mastery is the ability to transfer foundational rules to unfamiliar edge cases.`,
        visualType: 'equation',
        visualContent: {
          title: `Diagnostic Decision Matrix`,
          description: `Step-by-step resolution logic for ${cleanTopic}`,
          details: [
            `Identify symptoms or observed discrepancies`,
            `Trace back through governing principles to find root causes`,
            `Select optimal intervention to achieve desired outcome`
          ],
          steps: [
            `State the problem clearly with known constraints`,
            `Apply governing theorem or framework`,
            `Validate solution against physical or logical bounds`
          ]
        },
        checkpointQuestion: {
          questionText: `Why is verifying results against boundary constraints essential in ${cleanTopic}?`,
          options: [
            `To catch calculation errors and ensure solutions are physically/logically feasible`,
            `It is merely a formality that has no real impact`,
            `Boundary conditions never apply to real-world problems`,
            `Because computers cannot compute without them`
          ],
          correctIndex: 0,
          commonMisconception: `Accepting mathematical results that violate physical or practical reality.`,
          explanation: `Checking boundary conditions ensures that our model output corresponds to realistic, physically valid operational states.`
        }
      }
    ],
    finalAssessment: [
      {
        id: 'q1',
        question: `Which fundamental principle is central to understanding ${cleanTopic}?`,
        options: [
          `Cause-and-effect relationships governed by identifiable rules`,
          `Purely arbitrary behavior that cannot be predicted`,
          `Ignoring foundational definitions in favor of guessing`,
          `Assuming systems have infinite capacity without limits`
        ],
        correctAnswer: 0,
        conceptTested: `Foundational Mechanics`,
        hint: `Think about how scientific and engineering models are built.`
      },
      {
        id: 'q2',
        question: `How should you approach troubleshooting an unexpected result in ${cleanTopic}?`,
        options: [
          `Systematically verify assumptions, inputs, and intermediate steps`,
          `Discard the entire model immediately`,
          `Assume the measuring instruments are always wrong`,
          `Double the inputs without checking the cause`
        ],
        correctAnswer: 0,
        conceptTested: `Diagnostic Methodology`,
        hint: `Follow a structured root-cause analysis.`
      }
    ],
    recommendedNextTopics: [
      `Advanced Case Studies in ${cleanTopic}`,
      `Mathematical Modeling & Simulation`,
      `Cross-Disciplinary Applications`
    ]
  };
}

function generateFallbackEvaluation(question: string, studentAnswer: string, concept: string, language: string) {
  const answerLower = (studentAnswer || '').toLowerCase().trim();
  const isHindi = language.toLowerCase().includes('hindi') || language.toLowerCase().includes('hinglish');

  // Check the classic Ohm's Law question from the Hackathon prompt
  // Question: "What happens to current if resistance increases while voltage remains constant?"
  if (question.includes('resistance increases') || concept.includes('Ohm') || concept.includes('current')) {
    if (answerLower.includes('increase') || answerLower.includes('badhega') || answerLower.includes('zyada')) {
      return {
        isCorrect: false,
        confidenceScore: 95,
        feedback: isHindi
          ? 'Aapne kaha current badhega—lekin rukiye! Yahan ek bohot common misconception hai jo bohot se students karte hain.'
          : 'You answered that current increases—let us pause right there! This is one of the most classic misconceptions in electrical physics.',
        misconceptionDetected: 'Inverted Proportionality: Confusing Resistance with an accelerator rather than an opposition to electron flow.',
        underlyingReason: 'The student assumed that increasing resistance makes the circuit work harder and hence draw more current, rather than understanding that resistance physically restricts charge flow.',
        intuitiveAnalogy: isHindi
          ? 'Ek pipe ke baare me socho: agar pipe ke andar kachra bhar jaye (resistance badh jaye), toh paani ka bahav (current) kam ho jayega, badhega nahi!'
          : 'Think of a highway toll plaza: If more toll gates are closed (increased resistance), does traffic move faster or slower? It slows down! Resistance always opposes the flow.',
        reExplanation: 'Ohm\'s Law explicitly states that Current I = Voltage V / Resistance R. Since Resistance is in the denominator, as R increases, I MUST decrease.',
        adaptedFollowupQuestion: {
          questionText: 'Now, if you squeeze a flexible water hose tightly (increasing resistance), will the amount of water coming out per second increase or decrease?',
          hint: 'Remember what happened when the obstruction increased.'
        },
        suggestedDifficultyAdjustment: 'simplify'
      };
    } else if (answerLower.includes('decrease') || answerLower.includes('kam') || answerLower.includes('ghat') || answerLower.includes('drop')) {
      return {
        isCorrect: true,
        confidenceScore: 98,
        feedback: isHindi
          ? 'Bilkul sahi jawab! Shabaash. Resistance badhne se current kam hota hai kyunki dono inversely proportional hain.'
          : 'Spot on! Excellent scientific reasoning. Since Resistance directly opposes charge transport, increasing it under constant voltage decreases current.',
        misconceptionDetected: null,
        underlyingReason: 'The student correctly identified the inverse relationship defined by I = V / R.',
        intuitiveAnalogy: 'Just like tightening a valve reduces water throughput, higher electrical resistance throttles electron drift.',
        reExplanation: 'Because I = V / R, when R in the denominator expands, the overall quotient I shrinks proportionately.',
        adaptedFollowupQuestion: {
          questionText: 'Brilliant! If resistance is tripled from 5Ω to 15Ω at 30V, by what exact factor does current drop?',
          hint: 'Divide the old current by the new current.'
        },
        suggestedDifficultyAdjustment: 'advance'
      };
    }
  }

  // General evaluation
  return {
    isCorrect: true,
    confidenceScore: 85,
    feedback: isHindi
      ? 'Aapne achha prayas kiya! Yeh concept samajhne ke liye bahut zaroori hai.'
      : 'Great response! You are engaging directly with the core mechanics of this principle.',
    misconceptionDetected: null,
    underlyingReason: 'Demonstrates solid foundational grasp of the topic.',
    intuitiveAnalogy: 'Like building blocks, each foundational theorem supports the advanced architecture above it.',
    reExplanation: 'Keeping the fundamental relationships in focus ensures accurate problem-solving in any scenario.',
    adaptedFollowupQuestion: {
      questionText: 'Can you summarize how this principle applies to real-world engineering or software systems?',
      hint: 'Think about everyday devices or applications.'
    },
    suggestedDifficultyAdjustment: 'maintain'
  };
}

// Vite middleware in dev / static in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EchoMind server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
