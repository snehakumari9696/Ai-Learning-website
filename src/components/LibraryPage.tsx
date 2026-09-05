import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavedLessonRecord, TeacherAvatar } from '../types';
import { TEACHERS } from '../data/teachers';
import { BookOpen, Play, Calendar, Award, Trash2, Globe, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { LiquidGlassButton } from './LiquidGlassButton';
import { getSavedLessons } from '../services/api';

interface LibraryPageProps {
  onOpenLesson: (saved: SavedLessonRecord) => void;
  onStartNewLesson: () => void;
  onBack?: () => void;
}
export const LibraryPage: React.FC<LibraryPageProps> = ({ onOpenLesson, onStartNewLesson, onBack }) => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<SavedLessonRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const fetchLessons = async () => {
      if (!user) {
        setLessons([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const data = await getSavedLessons(user.id);
      
      if (data.length === 0) {
        // Initialize with default session record for first-time orientation just for display
        const initial: SavedLessonRecord[] = [
          {
            id: 'rec-init-1',
            topic: "Ohm's Law & Electrical Circuits",
            title: "Ohm's Law: Voltage, Current, and Resistance in Action",
            teacherName: 'Elena Baranova',
            teacherAvatarUrl: TEACHERS[0].imageUrl,
            language: user.preferredLanguage || 'English',
            level: 'beginner',
            date: new Date().toLocaleDateString(),
            completed: true,
            score: 100,
            lesson: {
              title: "Ohm's Law: Voltage, Current, and Resistance in Action",
              summary: 'Master the fundamental relationship between electric potential, charge flow, and opposition.',
              subjectCategory: 'physics',
              estimatedTimeMinutes: 20,
              curriculumModules: [],
              learningObjectives: [
                'Understand electric potential difference as the driving force',
                'Analyze how resistance restricts electron flow',
                'Apply I = V / R with confidence',
              ],
              finalAssessment: [],
              recommendedNextTopics: ['Kirchhoff Current Law', 'Series and Parallel Circuits'],
            },
          },
        ];
        setLessons(initial);
      } else {
        setLessons(data);
      }
      setIsLoading(false);
    };

    fetchLessons();
  }, [user]);

  const handleDelete = async (id: string) => {
    // Note: Backend endpoint for delete not implemented yet, so we just remove from UI for now.
    const updated = lessons.filter((l) => l.id !== id);
    setLessons(updated);
  };

  return (
    <div className="min-h-screen echomind-page-bg text-white font-geist pt-24 pb-32 px-4 sm:px-6 lg:px-8 overflow-y-auto selection:bg-emerald-500 selection:text-black">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Back Navigation Action */}
        {onBack && (
          <div>
            <LiquidGlassButton
              variant="subtle"
              size="sm"
              onClick={onBack}
              icon={<ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Back to Home
            </LiquidGlassButton>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/15">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-pill text-xs text-white/90 border border-white/20 mb-3 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono uppercase tracking-wider text-[11px] text-emerald-300">
                Personal Learning Repository
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
              Study Library & Lesson Transcripts
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl leading-relaxed">
              Review prior AI video sessions, revisit explanations, and track your conceptual growth.
            </p>
          </div>

          <LiquidGlassButton
            variant="primary"
            size="sm"
            onClick={onStartNewLesson}
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
            className="self-start sm:self-auto shadow-xl"
          >
            Generate New Lesson
          </LiquidGlassButton>
        </div>

        {/* Lesson Cards */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : lessons.length === 0 ? (
          <div className="p-12 text-center rounded-3xl liquid-glass-card border border-white/18 space-y-4 shadow-2xl backdrop-blur-2xl">
            <BookOpen className="w-10 h-10 text-white/30 mx-auto" />
            <h3 className="text-lg font-medium text-white">No lessons in your library yet</h3>
            <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
              Launch your first AI video classroom lesson on any topic to save notes and progress here.
            </p>
            <LiquidGlassButton
              variant="primary"
              size="sm"
              onClick={onStartNewLesson}
            >
              Start First Lesson
            </LiquidGlassButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {lessons.map((rec) => (
              <div
                key={rec.id}
                className="p-6 rounded-3xl liquid-glass-card border border-white/18 hover:border-white/35 transition-all shadow-xl flex flex-col justify-between gap-5 group hover:shadow-2xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={rec.teacherAvatarUrl}
                        alt={rec.teacherName}
                        className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/25"
                      />
                      <div>
                        <span className="text-xs font-semibold text-white block">{rec.teacherName}</span>
                        <span className="text-[11px] text-white/60 flex items-center gap-1 font-mono">
                          <Globe className="w-3 h-3 text-sky-400" />
                          <span>{rec.language}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full liquid-glass-pill text-emerald-300 border border-white/18 capitalize">
                        {rec.level}
                      </span>
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="p-1.5 text-white/40 hover:text-rose-400 rounded-lg transition-colors"
                        title="Remove from library"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                    {rec.title}
                  </h3>

                  <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
                    {rec.lesson?.summary || 'Interactive video lesson with visual demonstrations.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/15 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-white/50 font-mono">
                    <Calendar className="w-3 h-3" />
                    <span>{rec.date}</span>
                    {rec.score !== undefined && (
                      <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold ml-2">
                        <Award className="w-3.5 h-3.5" /> {rec.score}%
                      </span>
                    )}
                  </div>

                  <LiquidGlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenLesson(rec)}
                    icon={<Play className="w-3 h-3 fill-current" />}
                  >
                    Re-enter Class
                  </LiquidGlassButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
