import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Lazy initialize Gemini client
let geminiClient: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Candidate models in order of preference for text tasks
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

// In-memory model health & cooldown tracking
const modelCooldowns: Record<string, number> = {};

function isModelHealthy(model: string): boolean {
  const cooldownUntil = modelCooldowns[model];
  if (!cooldownUntil) return true;
  if (Date.now() > cooldownUntil) {
    delete modelCooldowns[model];
    return true;
  }
  return false;
}

function setModelCooldown(model: string, durationMs: number = 180000) {
  modelCooldowns[model] = Date.now() + durationMs;
}

// Clean potential markdown wrappers around JSON responses
export function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

// Robust Gemini invoker with automatic transient retry (503/429), model cooldowns, and model cascade fallback
export async function generateWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;

  // Prioritize healthy models first
  const orderedModels = [
    ...CANDIDATE_MODELS.filter(isModelHealthy),
    ...CANDIDATE_MODELS.filter((m) => !isModelHealthy(m)),
  ];

  for (const model of orderedModels) {
    // If currently in cooldown, skip unless no other models are available
    if (!isModelHealthy(model) && orderedModels.some(isModelHealthy)) {
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');

      const isQuotaExhausted =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota') ||
        msg.includes('exceeded your current quota');

      const isHighDemand =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('temporarily unavailable');

      if (isQuotaExhausted) {
        // Model quota reached; mark on cooldown for 3 minutes to prevent delayed retries
        setModelCooldown(model, 180000);
        console.info(`[Gemini API] ${model} quota reached. Cascading to next candidate model...`);
        continue;
      }

      if (isHighDemand) {
        // Model high demand; mark on cooldown for 45 seconds and cascade
        setModelCooldown(model, 45000);
        console.info(`[Gemini API] ${model} high demand (503). Cascading to next candidate model...`);
        continue;
      }

      console.warn(`[Gemini API] ${model} error (${msg.slice(0, 80)}). Cascading...`);
    }
  }

  throw lastError;
}

// Streaming equivalent of generateWithModelFallback
export async function generateStreamWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;

  const orderedModels = [
    ...CANDIDATE_MODELS.filter(isModelHealthy),
    ...CANDIDATE_MODELS.filter((m) => !isModelHealthy(m)),
  ];

  for (const model of orderedModels) {
    if (!isModelHealthy(model) && orderedModels.some(isModelHealthy)) {
      continue;
    }

    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: params.contents,
        config: params.config,
      });
      return stream;
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');

      const isQuotaExhausted =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota');

      const isHighDemand =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand');

      if (isQuotaExhausted) {
        setModelCooldown(model, 180000);
        console.info(`[Gemini API] ${model} quota reached. Cascading (Stream)...`);
        continue;
      }

      if (isHighDemand) {
        setModelCooldown(model, 45000);
        console.info(`[Gemini API] ${model} high demand (503). Cascading (Stream)...`);
        continue;
      }

      console.warn(`[Gemini API] ${model} error (${msg.slice(0, 80)}). Cascading (Stream)...`);
    }
  }

  throw lastError;
}

export function generateFallbackCurriculum(
  subjectGoal: string = 'Mastery Path',
  level: string = 'intermediate',
  language: string = 'English',
  weeklyHours: number = 5
) {
  const isHindi = language.toLowerCase().includes('hindi') || language.toLowerCase().includes('hinglish');
  const cleanGoal = subjectGoal || 'Core Conceptual Mastery';

  if (isHindi) {
    return {
      curriculumTitle: `${cleanGoal}: Sampoorna Margdarshak Path`,
      overview: `${cleanGoal} ke liye ek vyaktigat pathyakram, jisme ${level} level ke dhyan me rakhkar prati saptah ${weeklyHours} ghante padhai ka dhyan rakha gaya hai.`,
      estimatedWeeks: 4,
      prerequisites: [`Moolbhoot tarka shakti`, `Vishay me ruchi aur niyamit abhyas`],
      chapters: [
        {
          chapterNumber: 1,
          title: `${cleanGoal} ki Buniyad aur Mool Siddhant`,
          description: `Mukhya paribhashayein, siddhant aur buniyadi dharano ka gahraai se vishleshan.`,
          keyConcepts: ['First-principles vishleshan', 'Mukhya char aur paribhashayein', 'Buniyadi niyam'],
          estimatedHours: weeklyHours,
          difficulty: 'beginner',
          practicalProject: `Buniyadi sankalpa map aur aatm-mulyankan exercise.`
        },
        {
          chapterNumber: 2,
          title: `Gatisheel Pranali aur Samasya Nivaran`,
          description: `Karan aur prabhav ke sambandh, intermediate sthitiyan aur practical prayog.`,
          keyConcepts: ['Cause & effect correlation', 'System dynamics', 'Practical problem solving'],
          estimatedHours: weeklyHours,
          difficulty: 'intermediate',
          practicalProject: `Hands-on simulation aur model creation.`
        },
        {
          chapterNumber: 3,
          title: `Uchchatam Prayog aur Edge Cases`,
          description: `Gahan samasya nivaran, trutiyon ka pata lagana aur anukoolan.`,
          keyConcepts: ['Error diagnosis', 'Optimization', 'Real-world deployment'],
          estimatedHours: weeklyHours,
          difficulty: 'advanced',
          practicalProject: `Purna project ka nirman aur prastuti.`
        }
      ],
      capstoneProject: {
        title: `${cleanGoal} par Samagra Capstone Pariyojana`,
        description: `Sikhi gayi sabhi dharano ko jodkar ek vastavik samasya ka samadhan prastut karein.`,
        deliverables: ['Purna karyashil model', 'Vivaran dastavej', 'Mukhik prastutikaran']
      }
    };
  }

  return {
    curriculumTitle: `Personalized Trajectory: ${cleanGoal}`,
    overview: `A bespoke learning trajectory designed for ${level} level learners, paced at ${weeklyHours} hours per week with adaptive milestones.`,
    estimatedWeeks: 4,
    prerequisites: ['Foundational logical reasoning', 'Curiosity and regular study commitment'],
    chapters: [
      {
        chapterNumber: 1,
        title: `Foundations of ${cleanGoal}`,
        description: `Deconstruct fundamental definitions and establish core mental models from first principles.`,
        keyConcepts: ['First-principles decomposition', 'Core mechanics', 'Key governing variables'],
        estimatedHours: weeklyHours,
        difficulty: 'beginner',
        practicalProject: `Interactive conceptual map and baseline diagnostic challenge.`
      },
      {
        chapterNumber: 2,
        title: `System Dynamics & Problem Solving in ${cleanGoal}`,
        description: `Analyze intermediate relationships, transfer functions, and dynamic interactions.`,
        keyConcepts: ['Cause and effect mechanisms', 'System equilibrium', 'Troubleshooting bottlenecks'],
        estimatedHours: weeklyHours,
        difficulty: 'intermediate',
        practicalProject: `Hands-on analytical simulation challenge.`
      },
      {
        chapterNumber: 3,
        title: `Advanced Synthesis & Edge Cases in ${cleanGoal}`,
        description: `Tackle complex non-linear scenarios, boundary constraint validation, and optimizations.`,
        keyConcepts: ['Boundary testing', 'Performance tuning', 'Cross-domain integration'],
        estimatedHours: weeklyHours,
        difficulty: 'advanced',
        practicalProject: `Comprehensive case-study derivation and code/model artifact.`
      }
    ],
    capstoneProject: {
      title: `Comprehensive ${cleanGoal} Synthesis`,
      description: `Synthesize all theoretical foundations into a defensible real-world capstone solution.`,
      deliverables: ['Working prototype/model', 'Documented derivation', 'Oral walkthrough']
    }
  };
}
