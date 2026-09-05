import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { VideoPlayerStage } from './components/VideoPlayerStage';
import { AssessmentReportModal } from './components/AssessmentReportModal';
import { LessonSetupModal } from './components/LessonSetupModal';
import { CurriculumPage } from './components/CurriculumPage';
import { PracticePage } from './components/PracticePage';
import { LibraryPage } from './components/LibraryPage';
import { ProfilePage } from './components/ProfilePage';
import { AuthModal } from './components/AuthModal';
import { TEACHERS } from './data/teachers';
import { streamLesson, saveLesson } from './services/api';
import {
  PageRoute,
  LessonPlan,
  TeacherAvatar,
  LearnerLevel,
  LessonFormat,
  SavedLessonRecord,
  DurationOption,
  TeachingStyle,
} from './types';
import { Sparkles, Video, Play, BookOpen, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    isAuthenticated,
    isAuthModalOpen,
    closeAuthModal,
    openAuthModal,
    pendingRedirect,
    clearPendingRedirect,
    user,
  } = useAuth();

  const [currentRoute, setCurrentRoute] = useState<PageRoute>('home');
  const [activeLesson, setActiveLesson] = useState<LessonPlan | null>(null);
  const [activeTeacher, setActiveTeacher] = useState<TeacherAvatar>(TEACHERS[0]);
  const [activeLanguage, setActiveLanguage] = useState(user?.preferredLanguage || 'English');
  const [activeLevel, setActiveLevel] = useState<LearnerLevel>(user?.level || 'intermediate');
  const [activeFormat, setActiveFormat] = useState<LessonFormat>('video');
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync with user preferences when user logs in
  React.useEffect(() => {
    if (user) {
      if (user.preferredLanguage) setActiveLanguage(user.preferredLanguage);
      if (user.level) setActiveLevel(user.level);
      if (user.preferredTeacherId) {
        const found = TEACHERS.find((t) => t.id === user.preferredTeacherId);
        if (found) setActiveTeacher(found);
      }
    }
  }, [user]);

  const handleRouteChange = (route: PageRoute) => {
    setCurrentRoute(route);
  };

  const handleAuthSuccess = () => {
    if (pendingRedirect) {
      if (pendingRedirect.toLowerCase().includes('classroom')) {
        setCurrentRoute('classroom');
      } else if (pendingRedirect.toLowerCase().includes('curriculum')) {
        setCurrentRoute('curriculum');
      } else if (pendingRedirect.toLowerCase().includes('practice')) {
        setCurrentRoute('practice');
      } else if (pendingRedirect.toLowerCase().includes('library')) {
        setCurrentRoute('library');
      } else if (pendingRedirect.toLowerCase().includes('profile')) {
        setCurrentRoute('profile');
      }
      clearPendingRedirect();
    }
  };

  // Launch lesson from Hero or Setup
  const handleStartLessonGlobal = (
    lesson: LessonPlan,
    teacher: TeacherAvatar,
    language: string,
    level: LearnerLevel,
    format: LessonFormat
  ) => {
    setActiveLesson(lesson);
    setActiveTeacher(teacher);
    setActiveLanguage(language);
    setActiveLevel(level);
    setActiveFormat(format);
    setCurrentRoute('classroom');
  };

  // Start lesson from a curriculum chapter or practice suggestion
  const handleStartLessonOnTopic = async (
    topic: string,
    teacher: TeacherAvatar,
    level: LearnerLevel,
    language: string
  ) => {
    setIsGenerating(true);
    setActiveTeacher(teacher);
    setActiveLanguage(language);
    setActiveLevel(level);

    const payload = {
      topic,
      level,
      durationMinutes: 20,
      language,
      style: 'analogies' as TeachingStyle,
      teacherName: teacher.name,
      studentProfile: user
        ? {
            name: user.name,
            level: user.level,
          }
        : undefined,
    };

    await streamLesson(
      payload,
      (updatedLesson) => {
        setActiveLesson({ ...updatedLesson });
      },
      async (completedLesson) => {
        if (completedLesson.curriculumModules.length > 0) {
          if (user) {
            await saveLesson(
              {
                topic,
                title: completedLesson.title || topic,
                teacherName: teacher.name,
                teacherAvatarUrl: teacher.imageUrl,
                language,
                level,
                date: new Date().toLocaleDateString(),
                lesson: completedLesson,
                completed: false,
              },
              user.id
            );
          }
          setActiveLesson(completedLesson);
          setCurrentRoute('classroom');
        }
        setIsGenerating(false);
      },
      (error) => {
        console.error('Failed to generate lesson from topic:', error);
        setIsGenerating(false);
      }
    );
  };

  // Re-open a saved lesson from library
  const handleOpenSavedLesson = (saved: SavedLessonRecord) => {
    const foundTeacher = TEACHERS.find((t) => t.name === saved.teacherName) || TEACHERS[0];
    setActiveLesson(saved.lesson);
    setActiveTeacher(foundTeacher);
    setActiveLanguage(saved.language);
    setActiveLevel(saved.level);
    setCurrentRoute('classroom');
  };

  // Lesson Setup Modal trigger handler
  const handleModalStartLesson = async (config: {
    topic: string;
    materialText: string;
    level: LearnerLevel;
    durationMinutes: DurationOption;
    language: string;
    style: TeachingStyle;
    teacher: TeacherAvatar;
    format: LessonFormat;
  }) => {
    setIsGenerating(true);
    
    const payload = {
      topic: config.topic,
      materialText: config.materialText,
      level: config.level,
      durationMinutes: config.durationMinutes,
      language: config.language,
      style: config.style,
      teacherName: config.teacher.name,
      studentProfile: user
        ? {
            name: user.name,
            level: user.level,
            style: config.style,
          }
        : undefined,
    };

    await streamLesson(
      payload,
      (updatedLesson) => {
        setActiveLesson({ ...updatedLesson });
        setActiveTeacher(config.teacher);
        setActiveLanguage(config.language);
        setActiveLevel(config.level);
        setActiveFormat(config.format);
        // We don't close modal yet to show generating state if desired, or we can close it
        setIsSetupModalOpen(false); 
        setCurrentRoute('classroom');
      },
      async (completedLesson) => {
        if (completedLesson.curriculumModules.length > 0) {
          if (user) {
            await saveLesson(
              {
                topic: config.topic,
                title: completedLesson.title || config.topic,
                teacherName: config.teacher.name,
                teacherAvatarUrl: config.teacher.imageUrl,
                language: config.language,
                level: config.level,
                date: new Date().toLocaleDateString(),
                lesson: completedLesson,
                completed: false,
              },
              user.id
            );
          }
          setActiveLesson(completedLesson);
        }
        setIsGenerating(false);
      },
      (error) => {
        console.error('Failed to generate lesson:', error);
        setIsGenerating(false);
      }
    );
  };

  return (
    <div className="min-h-screen echomind-page-bg text-white selection:bg-emerald-500 selection:text-black">
      {/* Top Universal Navbar */}
      <Navbar
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        activeLanguage={activeLanguage}
      />

      {/* Main Multi-Page Switcher */}
      <main className="w-full">
        {/* 1. Home Page (Always publicly accessible without login!) */}
        {currentRoute === 'home' && (
          <Hero onStartLessonGlobal={handleStartLessonGlobal} />
        )}

        {/* 2. Interactive AI Video Classroom */}
        {currentRoute === 'classroom' && (
          <div className="pt-16 min-h-screen">
            {activeLesson ? (
              <>
                <VideoPlayerStage
                  lesson={activeLesson}
                  teacher={activeTeacher}
                  language={activeLanguage}
                  level={activeLevel}
                  initialFormat={activeFormat}
                  onFinishLesson={() => setIsAssessmentOpen(true)}
                  onExitLesson={() => setCurrentRoute('home')}
                />

                {isAssessmentOpen && (
                  <AssessmentReportModal
                    lesson={activeLesson}
                    teacher={activeTeacher}
                    onClose={() => {
                      setIsAssessmentOpen(false);
                      setCurrentRoute('library');
                    }}
                    onRetake={() => setIsAssessmentOpen(false)}
                  />
                )}
              </>
            ) : (
              <div className="max-w-4xl mx-auto py-20 px-4 text-center space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                  <Video className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-normal text-white">
                  Welcome to the Live AI Video Stage
                </h2>
                <p className="text-sm text-white/60 max-w-md mx-auto">
                  Select or upload any topic in physics, mathematics, or computer science to generate a personalized video lecture with real-time lip-sync and dynamic blackboard demonstrations.
                </p>
                <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={() => setIsSetupModalOpen(true)}
                    className="px-6 py-3 rounded-2xl bg-white text-zinc-950 hover:bg-white/90 font-semibold text-sm transition-all shadow-lg flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Configure New Lesson</span>
                  </button>
                  <button
                    onClick={() => setCurrentRoute('home')}
                    className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-sm transition-all flex items-center gap-2"
                  >
                    <span>Back to Home</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. AI Personalized Curriculum Studio */}
        {currentRoute === 'curriculum' && (
          <CurriculumPage
            onStartLessonOnTopic={handleStartLessonOnTopic}
            onBack={() => setCurrentRoute('home')}
          />
        )}

        {/* 4. Adaptive AI Practice & Misconception Arena */}
        {currentRoute === 'practice' && (
          <PracticePage onBack={() => setCurrentRoute('home')} />
        )}

        {/* 5. Personal Study Library */}
        {currentRoute === 'library' && (
          <LibraryPage
            onOpenLesson={handleOpenSavedLesson}
            onStartNewLesson={() => setIsSetupModalOpen(true)}
            onBack={() => setCurrentRoute('home')}
          />
        )}

        {/* 6. Student Profile */}
        {currentRoute === 'profile' && (
          <ProfilePage onBack={() => setCurrentRoute('home')} />
        )}
      </main>

      {/* Global Lesson Setup Modal */}
      <LessonSetupModal
        isOpen={isSetupModalOpen}
        selectedTeacher={activeTeacher}
        onClose={() => setIsSetupModalOpen(false)}
        onStartLesson={handleModalStartLesson}
        isGenerating={isGenerating}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
        featureName={pendingRedirect || undefined}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
