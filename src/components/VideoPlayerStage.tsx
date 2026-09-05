import React, { useState, useEffect, useRef } from 'react';
import { CurriculumModule, EvaluationResult, LessonPlan, TeacherAvatar, LessonFormat } from '../types';
import { TEACHERS } from '../data/teachers';
import { InteractiveCheckpoint } from './InteractiveCheckpoint';
import { AskTeacherDrawer } from './AskTeacherDrawer';
import { ClassroomVideoView } from './ClassroomVideoView';
import { AudioFormatView } from './AudioFormatView';
import { LiquidGlassButton } from './LiquidGlassButton';
import { selectVoiceForTeacher, testSpeakVoice, cleanSpeechScript } from '../utils/speechVoiceHelper';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Subtitles,
  MessageSquare,
  Award,
  ChevronRight,
  ChevronLeft,
  X,
  Video,
  Headphones,
  Sparkles,
  HelpCircle,
  UserCheck,
  Check,
} from 'lucide-react';

interface VideoPlayerStageProps {
  lesson: LessonPlan;
  teacher: TeacherAvatar;
  language: string;
  level: string;
  initialFormat?: LessonFormat;
  onFinishLesson: () => void;
  onExitLesson: () => void;
}

export const VideoPlayerStage: React.FC<VideoPlayerStageProps> = ({
  lesson,
  teacher,
  language,
  level,
  initialFormat = 'video',
  onFinishLesson,
  onExitLesson,
}) => {
  const [activeTeacher, setActiveTeacher] = useState<TeacherAvatar>(teacher);
  const [isTeacherPickerOpen, setIsTeacherPickerOpen] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState<'all' | 'female' | 'male'>('all');
  const [previewingTeacherId, setPreviewingTeacherId] = useState<string | null>(null);

  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [isAskingTeacher, setIsAskingTeacher] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<CurriculumModule | null>(null);
  const [lessonFormat, setLessonFormat] = useState<LessonFormat>(initialFormat);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeVoiceLabel, setActiveVoiceLabel] = useState<string>('');

  // Sync activeTeacher if prop changes
  useEffect(() => {
    setActiveTeacher(teacher);
  }, [teacher.id]);

  const modules = lesson.curriculumModules || [];
  const currentModule = modules[currentModuleIndex] || modules[0];

  // Web Speech Synthesis & Server Audio ref
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Speech Synthesis and populate gender-appropriate voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const updateVoices = () => {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          setVoices(v);
          const voiceChoice = selectVoiceForTeacher(
            v,
            activeTeacher.voiceGender,
            language,
            activeTeacher.voicePitch,
            activeTeacher.voiceRate
          );
          setActiveVoiceLabel(voiceChoice.voiceLabel);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      stopSpeech();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [activeTeacher.voiceGender, language, activeTeacher.voicePitch, activeTeacher.voiceRate]);

  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioLevel(0);
  };

  const speakText = (text: string, onEnd?: () => void, overrideAudioUrl?: string) => {
    stopSpeech();

    if (isMuted) {
      simulateSpeaking(onEnd);
      return;
    }

    const urlToPlay = overrideAudioUrl || (text === currentModule?.speechScript ? currentModule?.audioUrl : undefined);

    if (urlToPlay) {
      const audio = new Audio(urlToPlay);
      audio.playbackRate = playbackSpeed;
      audioRef.current = audio;
      
      audio.onplay = () => {
        setIsPlaying(true);
        startAudioVisualizerLoop();
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setAudioLevel(0);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (onEnd) onEnd();
      };
      
      audio.onerror = () => {
        console.warn('Failed to load server audio, falling back to local TTS');
        fallbackToLocalTTS();
      };
      
      audio.play().catch(() => fallbackToLocalTTS());
      return;
    }

    fallbackToLocalTTS();

    function fallbackToLocalTTS() {
      if (!synthRef.current) {
        simulateSpeaking(onEnd);
        return;
      }

      const sanitized = cleanSpeechScript(text);
      const utterance = new SpeechSynthesisUtterance(sanitized);
      utteranceRef.current = utterance;

    // Guaranteed gender-accurate voice selection
    const voiceResult = selectVoiceForTeacher(
      voices,
      activeTeacher.voiceGender,
      language,
      activeTeacher.voicePitch,
      activeTeacher.voiceRate
    );

    if (voiceResult.voice) {
      utterance.voice = voiceResult.voice;
    }
    utterance.pitch = voiceResult.pitch;
    utterance.rate = playbackSpeed * (activeTeacher.voiceRate || 1.0);

    // Language code mapping
    if (language.toLowerCase().includes('hindi')) {
      utterance.lang = 'hi-IN';
    } else if (language.toLowerCase().includes('spanish')) {
      utterance.lang = 'es-ES';
    } else if (language.toLowerCase().includes('french')) {
      utterance.lang = 'fr-FR';
    } else if (language.toLowerCase().includes('german')) {
      utterance.lang = 'de-DE';
    } else if (language.toLowerCase().includes('russian')) {
      utterance.lang = 'ru-RU';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      startAudioVisualizerLoop();
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setAudioLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      setIsPlaying(false);
      setAudioLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      simulateSpeaking(onEnd);
    };

    synthRef.current.speak(utterance);
    }
  };

  // Switch teacher in real time during the lesson
  const handleSelectTeacher = (newTeacher: TeacherAvatar) => {
    setActiveTeacher(newTeacher);
    setIsTeacherPickerOpen(false);

    // If audio is currently playing, smoothly transition to the new teacher's voice!
    if (isPlaying && currentModule) {
      stopSpeech();
      setTimeout(() => {
        speakText(currentModule.speechScript);
      }, 150);
    }
  };

  // Preview voice sample in teacher selection modal
  const handleVoicePreview = (t: TeacherAvatar, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewingTeacherId(t.id);
    const match = selectVoiceForTeacher(voices, t.voiceGender, language, t.voicePitch, t.voiceRate);
    const sample = t.voiceGender === 'female'
      ? `Hello! I am ${t.name}. I am now teaching this lesson with my female voice.`
      : `Greetings! I am ${t.name}. Let us proceed through the lesson together.`;
    testSpeakVoice(match.voice, match.pitch, match.rate, sample);
    setTimeout(() => setPreviewingTeacherId(null), 3500);
  };

  // Dynamic visualizer loop
  const startAudioVisualizerLoop = () => {
    const loop = () => {
      setAudioLevel(Math.random() * 0.7 + 0.3);
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const simulateSpeaking = (onEnd?: () => void) => {
    setIsPlaying(true);
    startAudioVisualizerLoop();
    setTimeout(() => {
      setIsPlaying(false);
      setAudioLevel(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (onEnd) onEnd();
    }, 4500);
  };

  // Play speech for current module when module changes
  useEffect(() => {
    if (currentModule) {
      speakText(currentModule.speechScript, () => {
        // If this module has an interactive checkpoint question, trigger it
        if (currentModule.checkpointQuestion) {
          setActiveCheckpoint(currentModule);
        }
      });
    }
  }, [currentModuleIndex]);

  const togglePlay = () => {
    if (isPlaying) {
      stopSpeech();
      setIsPlaying(false);
    } else {
      if (currentModule) {
        speakText(currentModule.speechScript);
      }
    }
  };

  const handleNextModule = () => {
    stopSpeech();
    if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex((prev) => prev + 1);
    } else {
      onFinishLesson();
    }
  };

  const handlePrevModule = () => {
    stopSpeech();
    if (currentModuleIndex > 0) {
      setCurrentModuleIndex((prev) => prev - 1);
    }
  };

  const handleCheckpointResolved = (result: EvaluationResult) => {
    setActiveCheckpoint(null);
    if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex((prev) => prev + 1);
    } else {
      onFinishLesson();
    }
  };

  const progressPercent = modules.length > 0 ? ((currentModuleIndex + 1) / modules.length) * 100 : 0;

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] flex flex-col justify-between echomind-page-bg font-geist text-white select-none pb-8 overflow-y-auto">
      {/* Top Video Stage Bar */}
      <header className="relative z-20 flex items-center justify-between px-3 sm:px-8 py-2.5 bg-gradient-to-b from-black/85 via-black/50 to-transparent border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onExitLesson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all font-medium text-xs shadow-sm hover:scale-[1.02]"
            title="Return to Home / Overview"
          >
            <ChevronLeft className="w-4 h-4 text-emerald-400" />
            <span>Back to Home</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                LIVE AI LESSON
              </span>
              <span className="text-xs text-white/50">{lesson.subjectCategory.toUpperCase()}</span>
            </div>
            <h1 className="text-sm sm:text-base font-medium text-white truncate max-w-xs sm:max-w-md">
              {lesson.title}
            </h1>
          </div>
        </div>

        {/* Lecturer Quick Switcher in Header */}
        <button
          type="button"
          onClick={() => setIsTeacherPickerOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-all shadow-sm"
          title="Click to choose a different instructor"
        >
          <img
            src={activeTeacher.imageUrl}
            alt={activeTeacher.name}
            referrerPolicy="no-referrer"
            className="w-5 h-5 rounded-full object-cover ring-1 ring-white/30"
          />
          <span className="font-semibold">{activeTeacher.name}</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              activeTeacher.voiceGender === 'female'
                ? 'bg-pink-500/20 text-pink-300'
                : 'bg-sky-500/20 text-sky-300'
            }`}
          >
            {activeTeacher.voiceGender === 'female' ? '♀ Female Voice' : '♂ Male Voice'}
          </span>
          <ChevronRight className="w-3 h-3 text-white/50 rotate-90" />
        </button>

        {/* FORMAT TOGGLE (VIDEO CLASSROOM VS AUDIO ONLY) */}
        <div className="flex items-center p-1 rounded-2xl bg-black/60 border border-white/15 backdrop-blur-xl shadow-lg">
          <button
            onClick={() => setLessonFormat('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              lessonFormat === 'video'
                ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border border-emerald-400/50 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            title="Classroom Video Mode (Animated Teacher & Blackboard)"
          >
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Classroom Video</span>
            <span className="sm:hidden">Video</span>
          </button>

          <button
            onClick={() => setLessonFormat('audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              lessonFormat === 'audio'
                ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border border-cyan-400/50 text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            title="Audio Podcast Mode (Waveform, Medallion & Teleprompter)"
          >
            <Headphones className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Audio Format</span>
            <span className="sm:hidden">Audio</span>
          </button>
        </div>

        {/* Action Controls Top Right */}
        <div className="flex items-center gap-2">
          <LiquidGlassButton
            variant="default"
            size="sm"
            onClick={() => setIsAskingTeacher(true)}
            icon={<MessageSquare className="w-3.5 h-3.5 text-amber-300" />}
          >
            <span className="hidden md:inline">Ask {activeTeacher.name.split(' ')[0]}</span>
            <span className="md:hidden">Ask</span>
          </LiquidGlassButton>

          <LiquidGlassButton
            variant="accent"
            size="sm"
            onClick={onFinishLesson}
            icon={<Award className="w-3.5 h-3.5" />}
          >
            <span className="hidden md:inline">Assessment</span>
            <span className="md:hidden">Quiz</span>
          </LiquidGlassButton>

          <button
            onClick={onExitLesson}
            className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-1"
            title="Close Lesson"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Studio Viewport (Renders Video Classroom OR Audio Podcast) */}
      <main className="relative z-10 flex-1 p-2 sm:p-5 overflow-hidden flex flex-col justify-center">
        {lessonFormat === 'video' ? (
          <ClassroomVideoView
            teacher={activeTeacher}
            currentModule={currentModule}
            currentModuleIndex={currentModuleIndex}
            totalModules={modules.length}
            isPlaying={isPlaying}
            audioLevel={audioLevel}
            category={lesson.subjectCategory}
            language={language}
            onRaiseHand={() => setIsAskingTeacher(true)}
            voiceLabel={activeVoiceLabel}
            onTogglePlay={togglePlay}
            onNextModule={handleNextModule}
            onPrevModule={handlePrevModule}
            playbackRate={playbackSpeed}
            onChangePlaybackRate={(r) => setPlaybackSpeed(r)}
            onSwitchTeacher={() => setIsTeacherPickerOpen(true)}
          />
        ) : (
          <AudioFormatView
            teacher={activeTeacher}
            currentModule={currentModule}
            currentModuleIndex={currentModuleIndex}
            totalModules={modules.length}
            isPlaying={isPlaying}
            audioLevel={audioLevel}
            language={language}
            playbackSpeed={playbackSpeed}
            onSpeedChange={(speed) => setPlaybackSpeed(speed)}
            onSeekPrev={handlePrevModule}
            onSeekNext={handleNextModule}
            onReplay={() => {
              stopSpeech();
              if (currentModule) speakText(currentModule.speechScript);
            }}
            voiceLabel={activeVoiceLabel}
          />
        )}
      </main>

      {/* Closed Captions Subtitles Overlay */}
      {showCaptions && currentModule && lessonFormat === 'video' && (
        <div className="relative z-20 px-4 sm:px-8 -mt-2 mb-1 flex justify-center">
          <div className="max-w-3xl w-full text-center px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 shadow-lg text-xs sm:text-sm text-white/95 leading-relaxed animate-[fadeIn_0.3s_ease]">
            <span className="text-amber-300 font-semibold mr-1.5">
              {activeTeacher.name} ({activeTeacher.voiceGender === 'female' ? '♀ Female' : '♂ Male'}):
            </span>
            <span>"{currentModule.speechScript}"</span>
          </div>
        </div>
      )}

      {/* Bottom Video Scrubbing Bar & Controls */}
      <footer className="relative z-20 px-4 sm:px-8 py-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent border-t border-white/10 backdrop-blur-md flex flex-col gap-2">
        {/* Progress Timeline bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/60 min-w-[36px]">
            {String(currentModuleIndex + 1).padStart(2, '0')}:{String(modules.length).padStart(2, '0')}
          </span>

          {/* Module segmented scrub bar */}
          <div className="flex-1 flex gap-1 h-2 rounded-full overflow-hidden bg-white/10 p-0.5">
            {modules.map((m, idx) => (
              <button
                key={m.id || idx}
                type="button"
                onClick={() => {
                  stopSpeech();
                  setCurrentModuleIndex(idx);
                }}
                className={`flex-1 h-full rounded-full transition-all cursor-pointer ${
                  idx < currentModuleIndex
                    ? 'bg-emerald-400'
                    : idx === currentModuleIndex
                    ? 'bg-white shadow-[0_0_8px_white]'
                    : 'bg-white/15 hover:bg-white/30'
                }`}
                title={`Section ${idx + 1}: ${m.title}`}
              />
            ))}
          </div>

          <span className="text-xs font-mono text-white/60 min-w-[40px] text-right">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* Player Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevModule}
              disabled={currentModuleIndex === 0}
              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/70 hover:text-white disabled:opacity-30 transition-all"
              title="Previous Module"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <LiquidGlassButton
              variant="primary"
              size="md"
              onClick={togglePlay}
              icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </LiquidGlassButton>

            <button
              onClick={handleNextModule}
              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/70 hover:text-white transition-all"
              title="Next Module"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                stopSpeech();
                if (currentModule) speakText(currentModule.speechScript);
              }}
              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/70 hover:text-white transition-all"
              title="Replay Module Audio"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Center Title or Checkpoint Prompt */}
          <div className="hidden md:flex items-center gap-2 text-xs text-white/70">
            {currentModule?.checkpointQuestion && (
              <button
                onClick={() => setActiveCheckpoint(currentModule)}
                className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs hover:bg-amber-500/30 transition-colors animate-pulse"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Interactive Checkpoint Ready</span>
              </button>
            )}
          </div>

          {/* Right Utility buttons */}
          <div className="flex items-center gap-2 text-xs">
            {/* Speed Toggle */}
            <button
              onClick={() => {
                const speeds = [0.75, 1.0, 1.25, 1.5];
                const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                setPlaybackSpeed(next);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/80 font-mono text-xs border border-white/10"
              title="Playback Speed"
            >
              {playbackSpeed}x
            </button>

            {/* Mute Toggle */}
            <button
              onClick={() => {
                if (!isMuted) stopSpeech();
                setIsMuted(!isMuted);
              }}
              className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white/70 hover:text-white transition-all"
              title={isMuted ? 'Unmute' : 'Mute Voice'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Closed Captions toggle */}
            <button
              onClick={() => setShowCaptions(!showCaptions)}
              className={`p-2 rounded-xl transition-all ${
                showCaptions
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/[0.06] text-white/50 hover:text-white'
              }`}
              title="Toggle Subtitles"
            >
              <Subtitles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {/* Checkpoint Dialog Modal Overlay (When Question Arrives) */}
      {activeCheckpoint && activeCheckpoint.checkpointQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-[fadeIn_0.3s_ease]">
          <InteractiveCheckpoint
            question={activeCheckpoint.checkpointQuestion}
            conceptTitle={activeCheckpoint.title}
            teacher={activeTeacher}
            language={language}
            level={level}
            onResolved={handleCheckpointResolved}
            onSkip={() => setActiveCheckpoint(null)}
          />
        </div>
      )}

      {/* In-Lesson Ask Teacher Drawer */}
      <AskTeacherDrawer
        teacher={activeTeacher}
        currentTopic={lesson.title}
        currentModule={currentModule}
        language={language}
        isOpen={isAskingTeacher}
        onClose={() => setIsAskingTeacher(false)}
        onSpeakText={(text) => speakText(text)}
      />

      {/* Real-time Teacher Faculty Switcher Modal */}
      {isTeacherPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease]">
          <div className="relative w-full max-w-2xl bg-zinc-900/95 border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[88vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  Select Lesson Instructor
                </h3>
                <p className="text-xs text-white/60">
                  Switch faculty anytime — female or male voice synthesis adjusts dynamically
                </p>
              </div>
              <button
                onClick={() => setIsTeacherPickerOpen(false)}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10 text-xs self-start">
              <button
                type="button"
                onClick={() => setTeacherFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  teacherFilter === 'all'
                    ? 'bg-white/20 text-white font-medium shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                All Faculty ({TEACHERS.length})
              </button>
              <button
                type="button"
                onClick={() => setTeacherFilter('female')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  teacherFilter === 'female'
                    ? 'bg-pink-500/25 border border-pink-500/40 text-pink-200 font-medium shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>♀ Female Voice</span>
              </button>
              <button
                type="button"
                onClick={() => setTeacherFilter('male')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  teacherFilter === 'male'
                    ? 'bg-sky-500/25 border border-sky-500/40 text-sky-200 font-medium shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>♂ Male Voice</span>
              </button>
            </div>

            {/* Faculty Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] flex-1">
              {TEACHERS.filter((t) => {
                if (teacherFilter === 'female') return t.voiceGender === 'female';
                if (teacherFilter === 'male') return t.voiceGender === 'male';
                return true;
              }).map((t) => {
                const isSelected = activeTeacher.id === t.id;
                const isPreviewing = previewingTeacherId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTeacher(t)}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white/20 border-white ring-2 ring-white/50 shadow-xl'
                        : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={t.imageUrl}
                          alt={t.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-white/25"
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${
                            t.voiceGender === 'female' ? 'bg-pink-600' : 'bg-sky-600'
                          }`}
                        >
                          {t.voiceGender === 'female' ? '♀' : '♂'}
                        </span>
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white block truncate">{t.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                        <span className="text-[11px] text-white/60 block truncate">{t.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px]">
                      <span
                        className={`font-mono px-2 py-0.5 rounded font-medium ${
                          t.voiceGender === 'female'
                            ? 'bg-pink-500/20 text-pink-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {t.voiceGender === 'female' ? '♀ Female Vocal' : '♂ Male Vocal'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleVoicePreview(t, e)}
                        className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                          isPreviewing
                            ? 'bg-emerald-500 text-black font-semibold animate-pulse'
                            : 'bg-white/10 hover:bg-white/20 text-white/90 hover:text-white'
                        }`}
                        title="Preview this teacher's voice"
                      >
                        {isPreviewing ? (
                          <>
                            <Volume2 className="w-3 h-3 animate-spin" />
                            <span>Previewing...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5" />
                            <span>Hear Voice</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTeacherPickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
