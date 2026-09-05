import React, { useState } from 'react';
import { TEACHERS } from '../data/teachers';
import { AvatarPicker } from './AvatarPicker';
import { LessonSetupModal } from './LessonSetupModal';
import { VideoPlayerStage } from './VideoPlayerStage';
import { AssessmentReportModal } from './AssessmentReportModal';
import { LiquidGlassButton } from './LiquidGlassButton';
import { useAuth } from '../context/AuthContext';
import { streamLesson, saveLesson } from '../services/api';
import {
  DurationOption,
  LearnerLevel,
  LessonPlan,
  TeacherAvatar,
  TeachingStyle,
  LessonFormat,
  SavedLessonRecord,
} from '../types';
import { Sparkles, Play, Award, BookOpen, Layers, Lock, ShieldCheck } from 'lucide-react';

interface HeroProps {
  onStartLessonGlobal?: (
    lesson: LessonPlan,
    teacher: TeacherAvatar,
    language: string,
    level: LearnerLevel,
    format: LessonFormat
  ) => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartLessonGlobal }) => {
  const { isAuthenticated, openAuthModal, user } = useAuth();

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherAvatar>(TEACHERS[0]);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeLesson, setActiveLesson] = useState<LessonPlan | null>(null);
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [lessonLanguage, setLessonLanguage] = useState(user?.preferredLanguage || 'English');
  const [lessonLevel, setLessonLevel] = useState<LearnerLevel>(user?.level || 'beginner');
  const [lessonFormat, setLessonFormat] = useState<LessonFormat>('video');

  const activeTeacher = TEACHERS[activeIndex];

  // When active index changes via AvatarPicker, keep selectedTeacher in sync
  const handleSelectAvatar = (index: number) => {
    setActiveIndex(index);
    setSelectedTeacher(TEACHERS[index]);
  };

  // Launch a new video lesson
  const handleStartLesson = async (config: {
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
    setLessonLanguage(config.language);
    setLessonLevel(config.level);
    setLessonFormat(config.format);
    setSelectedTeacher(config.teacher);

    // Update activeIndex to match chosen teacher if they changed in modal
    const matchedIdx = TEACHERS.findIndex((t) => t.id === config.teacher.id);
    if (matchedIdx !== -1) {
      setActiveIndex(matchedIdx);
    }

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

          if (onStartLessonGlobal) {
            onStartLessonGlobal(
              completedLesson,
              config.teacher,
              config.language,
              config.level,
              config.format
            );
          } else {
            setActiveLesson(completedLesson);
          }
          setIsSetupOpen(false);
        }
        setIsGenerating(false);
      },
      (error) => {
        console.error('Lesson stream error:', error);
        setIsGenerating(false);
      }
    );
  };

  // Quick Start with auth check
  const handleQuickStart = () => {
    if (!isAuthenticated) {
      openAuthModal('AI Video Lesson Classroom');
      return;
    }
    setIsSetupOpen(true);
  };

  const handleUploadOrTopic = () => {
    if (!isAuthenticated) {
      openAuthModal('Upload PDF / Topic');
      return;
    }
    setIsSetupOpen(true);
  };

  // If active lesson is ongoing, render VideoPlayerStage
  if (activeLesson) {
    return (
      <>
        <VideoPlayerStage
          lesson={activeLesson}
          teacher={selectedTeacher}
          language={lessonLanguage}
          level={lessonLevel}
          initialFormat={lessonFormat}
          onFinishLesson={() => setIsAssessmentOpen(true)}
          onExitLesson={() => setActiveLesson(null)}
        />

        {isAssessmentOpen && (
          <AssessmentReportModal
            lesson={activeLesson}
            teacher={selectedTeacher}
            onClose={() => {
              setIsAssessmentOpen(false);
              setActiveLesson(null);
            }}
            onRetake={() => {
              setIsAssessmentOpen(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <section className="relative h-screen w-full overflow-hidden font-geist text-white select-none">
      {/* 1. Full-bleed stacked background portraits (All 8 backgrounds rendered, 700ms crossfade) */}
      {TEACHERS.map((teacher, index) => {
        const isActive = activeIndex === index;
        return (
          <div
            key={teacher.id}
            style={{ backgroundImage: `url("${teacher.imageUrl}")` }}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${
              isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
        );
      })}

      {/* 2. Light dark gradient overlay on top of the backgrounds */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-black/25 pointer-events-none" />

      {/* 3. Content layer (z-10) with two vertical zones: top and bottom */}
      <div className="relative z-10 flex h-full flex-col justify-between px-6 pb-6 pt-10 sm:px-10 sm:pb-8 sm:pt-14 lg:px-16">
        {/* Top zone — headline + bio & AI Teacher Launch action */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-16">
          {/* Left — H1 (static, never changes) */}
          <div className="max-w-xl space-y-4">
            <h1 className="text-3xl font-normal leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-7xl">
              EchoMind is the talent you build with each&nbsp;day
            </h1>

            {/* AI Teacher Badge & Trigger */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <LiquidGlassButton
                variant="primary"
                size="lg"
                onClick={handleQuickStart}
                icon={<Play className="w-4 h-4 fill-white" />}
                className="shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              >
                Start AI Video Lesson
              </LiquidGlassButton>

              <button
                type="button"
                onClick={handleUploadOrTopic}
                className="text-xs font-mono tracking-wider uppercase text-white/80 hover:text-white bg-black/40 hover:bg-black/60 px-4 py-3 rounded-2xl border border-white/20 backdrop-blur-md transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Upload PDF / Topic
              </button>
            </div>
          </div>

          {/* Right — description (changes with active slide) */}
          <div className="max-w-xs md:pt-2 space-y-4">
            <p
              key={activeTeacher.name}
              className="text-sm font-medium leading-relaxed text-white/80 sm:text-base animate-[fadeIn_0.5s_ease]"
            >
              {activeTeacher.description}
            </p>

            {/* Faculty Specialty Tag with Liquid Glass Pill & Voice Gender Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                key={`spec-${activeTeacher.name}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-pill text-xs text-white/90 animate-[fadeIn_0.5s_ease]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Specialty: {activeTeacher.specialty}</span>
              </div>

              <div
                key={`voice-${activeTeacher.name}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 border border-white/15 text-xs text-white/80 animate-[fadeIn_0.5s_ease]"
              >
                <span className={`w-2 h-2 rounded-full ${activeTeacher.voiceGender === 'female' ? 'bg-pink-400' : 'bg-sky-400'}`} />
                <span>{activeTeacher.voiceGender === 'female' ? 'Female Voice' : 'Male Voice'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom zone — Avatar picker row & Meta footer */}
        <div className="flex flex-col gap-8">
          {/* Avatar picker row (Order 1->8, dot fades in/out, 40px->56px circles) */}
          <AvatarPicker activeIndex={activeIndex} onSelect={handleSelectAvatar} />

          {/* Meta footer */}
          <div className="border-t border-white/20 pt-5 flex flex-wrap items-center justify-between gap-4 text-sm font-medium">
            {/* 1. Name (always visible, remounts with key + animate-[fadeIn_0.5s_ease]) */}
            <span
              key={activeTeacher.name}
              className="text-white animate-[fadeIn_0.5s_ease]"
            >
              {activeTeacher.name}
            </span>

            {/* 2. Role (hidden on mobile, visible sm:+) */}
            <span
              key={activeTeacher.role}
              className="hidden sm:inline text-white/70"
            >
              {activeTeacher.role}
            </span>

            {/* 3. Static tenure (hidden until md) */}
            <span className="hidden md:inline text-white/70">
              In the business since 2020
            </span>

            {/* 4. WhatsApp link */}
            <a
              href="https://wa.me/917347654757"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 transition-colors hover:text-white/70"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Lesson Setup Modal (Supports PDF/Notes Upload, Level, Duration, Language, Style) */}
      <LessonSetupModal
        isOpen={isSetupOpen}
        selectedTeacher={activeTeacher}
        onClose={() => setIsSetupOpen(false)}
        onStartLesson={handleStartLesson}
        isGenerating={isGenerating}
      />
    </section>
  );
};
