import { Worker, Job } from 'bullmq';
import redis from '../redis';
import { getGemini, generateWithModelFallback, cleanJsonString, generateFallbackCurriculum } from '../ai';

export const syllabusWorker = new Worker(
  'curriculum-generation',
  async (job: Job) => {
    const {
      subjectGoal,
      level = 'intermediate',
      language = 'English',
      weeklyHours = 5,
      teacherName = 'Elena Baranova',
      priorKnowledge = '',
    } = job.data;

    const ai = getGemini();

    if (ai) {
      const prompt = `You are ${teacherName}, an elite AI academic dean at EchoMind.
Generate a completely personalized, structured learning curriculum tailored for:
- Learning Goal/Topic: "${subjectGoal}"
- Learner Level: "${level}"
- Weekly Time Commitment: ${weeklyHours} hours
- Language: "${language}"
- Prior Knowledge: "${priorKnowledge || 'None provided; start from appropriate entry point'}"

CRITICAL LANGUAGE MANDATE:
All titles, module descriptions, milestones, outcomes, and prerequisites MUST be written fluently in ${language}.

Format strictly as JSON:
{
  "curriculumTitle": string,
  "overview": string,
  "estimatedWeeks": number,
  "prerequisites": string[],
  "chapters": [
    {
      "chapterNumber": number,
      "title": string,
      "description": string,
      "keyConcepts": string[],
      "estimatedHours": number,
      "difficulty": "beginner" | "intermediate" | "advanced",
      "practicalProject": string
    }
  ],
  "capstoneProject": {
    "title": string,
    "description": string,
    "deliverables": string[]
  }
}
Return ONLY valid JSON.`;

      try {
        const response = await generateWithModelFallback(ai, {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });

        const text = cleanJsonString(response.text?.trim() || '{}');
        const parsed = JSON.parse(text);
        
        // Return the parsed curriculum as the job's result
        return parsed;
      } catch (err: any) {
        console.warn('Curriculum generation fallback triggered in worker:', err?.message);
        return generateFallbackCurriculum(subjectGoal, level, language, weeklyHours);
      }
    }

    // Dynamic fallback if AI client is missing
    return generateFallbackCurriculum(subjectGoal, level, language, weeklyHours);
  },
  { connection: redis }
);

syllabusWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err.message}`);
});

syllabusWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed successfully.`);
});
