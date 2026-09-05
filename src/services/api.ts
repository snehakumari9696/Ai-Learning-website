import {
  DurationOption,
  LearnerLevel,
  LessonPlan,
  TeacherAvatar,
  TeachingStyle,
  LessonFormat,
  SavedLessonRecord,
} from '../types';

interface GenerateLessonPayload {
  topic: string;
  materialText?: string;
  level: LearnerLevel;
  durationMinutes: DurationOption | number;
  language: string;
  style: TeachingStyle;
  teacherName: string;
  studentProfile?: {
    name?: string;
    level?: string;
    style?: string;
  };
}

export const streamLesson = async (
  payload: GenerateLessonPayload,
  onUpdate: (lesson: LessonPlan) => void,
  onComplete?: (lesson: LessonPlan) => void,
  onError?: (error: Error) => void
) => {
  try {
    const res = await fetch('/api/generate-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.body) {
      throw new Error('No response body from server');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let streamedLesson: LessonPlan = {
      title: payload.topic,
      summary: 'Generating lesson...',
      subjectCategory: 'general',
      estimatedTimeMinutes: typeof payload.durationMinutes === 'number' ? payload.durationMinutes : 20,
      curriculumModules: [],
      learningObjectives: [],
      finalAssessment: [],
      recommendedNextTopics: [],
    };

    // Initial update
    onUpdate(streamedLesson);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        if (chunk.startsWith('data: ')) {
          const dataStr = chunk.slice(6);
          try {
            const event = JSON.parse(dataStr);
            if (event.type === 'module') {
              streamedLesson = {
                ...streamedLesson,
                curriculumModules: [...streamedLesson.curriculumModules, event.data],
              };
              onUpdate(streamedLesson);
            } else if (event.type === 'metadata') {
              streamedLesson = {
                ...streamedLesson,
                ...event.data,
                curriculumModules: streamedLesson.curriculumModules,
              };
              onUpdate(streamedLesson);
            } else if (event.type === 'fallback') {
              streamedLesson = event.data;
              onUpdate(streamedLesson);
            } else if (event.type === 'error') {
              console.error('Server reported error:', event.message);
              if (onError) onError(new Error(event.message));
            } else if (event.type === 'done') {
              // Generation finished.
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk', e);
          }
        }
      }
    }
    
    if (onComplete) {
      onComplete(streamedLesson);
    }
  } catch (err: any) {
    console.error('Failed to generate lesson:', err);
    if (onError) onError(err);
  }
};

// Database APIs replacing localStorage
export const getSavedLessons = async (userId: string): Promise<SavedLessonRecord[]> => {
  try {
    const res = await fetch(`/api/lessons?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch lessons');
    const data = await res.json();
    return data.lessons;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const saveLesson = async (lessonRecord: Omit<SavedLessonRecord, 'id'>, userId: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lessonRecord, userId }),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const getProfile = async (userId: string) => {
  try {
    const res = await fetch(`/api/profile?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    const data = await res.json();
    return data.profile;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const updateProfile = async (userId: string, updates: any): Promise<boolean> => {
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...updates }),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
};
