import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TEACHERS } from '../data/teachers';
import { User, Globe, Award, BookOpen, Check, ShieldCheck, Sparkles, Volume2, ArrowLeft } from 'lucide-react';
import { LearnerLevel, TeacherAvatar } from '../types';
import { testSpeakVoice, selectVoiceForTeacher } from '../utils/speechVoiceHelper';
import { LiquidGlassButton } from './LiquidGlassButton';
import { updateProfile } from '../services/api';

interface ProfilePageProps {
  onBack?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { user, updateUserProfile } = useAuth();

  const [name, setName] = useState(user?.name || 'Alex Mercer');
  const [level, setLevel] = useState<LearnerLevel>(user?.level || 'intermediate');
  const [language, setLanguage] = useState(user?.preferredLanguage || 'English');
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    user?.preferredTeacherId || TEACHERS[0].id
  );
  const [isSaved, setIsSaved] = useState(false);

  const selectedTeacher =
    TEACHERS.find((t) => t.id === selectedTeacherId) || TEACHERS[0];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && !user.isGuest) {
      await updateProfile(user.id, {
        name,
        level,
        preferredLanguage: language,
        preferredTeacherId: selectedTeacherId,
      });
    }
    updateUserProfile({
      name,
      level,
      preferredLanguage: language,
      preferredTeacherId: selectedTeacherId,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestVoice = (teacher: TeacherAvatar) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const match = selectVoiceForTeacher(
      voices,
      teacher.voiceGender,
      language,
      teacher.voicePitch,
      teacher.voiceRate
    );
    testSpeakVoice(
      match.voice,
      match.pitch,
      match.rate,
      language.toLowerCase().includes('hindi')
        ? `Namaste ${name}! Main ${teacher.name} hoon, aapki AI shikshak.`
        : language.toLowerCase().includes('spanish')
        ? `¡Hola ${name}! Soy ${teacher.name}, tu profesora de inteligencia artificial.`
        : `Hello ${name}! I am ${teacher.name}, your personalized AI mentor.`
    );
  };

  return (
    <div className="min-h-screen echomind-page-bg text-white font-geist pt-24 pb-32 px-4 sm:px-6 lg:px-8 overflow-y-auto selection:bg-emerald-500 selection:text-black">
      <div className="max-w-4xl mx-auto space-y-8">
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
                Learner Identity & Pedagogical Profile
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
              Student Settings & Preferences
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl leading-relaxed">
              Customize your learning velocity, preferred instructional language, and default mentor avatar.
            </p>
          </div>

          {user?.isGuest && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-pill border border-amber-400/30 text-xs text-amber-300 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span className="font-semibold">Guest Scholar Mode</span>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <form onSubmit={handleSave} className="space-y-8">
          <div className="liquid-glass-card border border-white/18 rounded-3xl p-6 sm:p-8 space-y-6 backdrop-blur-2xl shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Personal Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-white/70 tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/18 text-white text-sm focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30 transition-all shadow-inner"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-white/70 tracking-wider">
                  Registered Email
                </label>
                <input
                  type="email"
                  value={user?.email || 'scholar@echomind.ai'}
                  disabled
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-white/50 text-sm cursor-not-allowed font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-white/70 tracking-wider">
                  Mastery Level
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as LearnerLevel)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/18 text-xs text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30"
                >
                  <option value="beginner" className="bg-zinc-900">Beginner (Foundational analogies)</option>
                  <option value="intermediate" className="bg-zinc-900">Intermediate (Theory & Practice)</option>
                  <option value="advanced" className="bg-zinc-900">Advanced (Mathematical Rigor)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-white/70 tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>Instruction & Speech Language</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/18 text-xs text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30"
                >
                  <option value="English" className="bg-zinc-900">English (Global)</option>
                  <option value="Hindi" className="bg-zinc-900">Hindi (हिंदी)</option>
                  <option value="Spanish" className="bg-zinc-900">Spanish (Español)</option>
                  <option value="French" className="bg-zinc-900">French (Français)</option>
                  <option value="German" className="bg-zinc-900">German (Deutsch)</option>
                  <option value="Russian" className="bg-zinc-900">Russian (Русский)</option>
                  <option value="Japanese" className="bg-zinc-900">Japanese (日本語)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Teacher Selection with Voice Preview */}
          <div className="liquid-glass-card border border-white/18 rounded-3xl p-6 sm:p-8 space-y-6 backdrop-blur-2xl shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">Preferred Lead Instructor</h3>
                <p className="text-xs text-white/70 mt-1">
                  Select your primary faculty mentor. Teachers 1, 2, and 4 feature female voices; the rest feature male voices.
                </p>
              </div>

              <span className="text-xs font-mono text-emerald-300 px-3 py-1 rounded-full liquid-glass-pill border border-white/18">
                Selected: {selectedTeacher.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {TEACHERS.map((teacher, idx) => {
                const isSelected = teacher.id === selectedTeacherId;
                const isFemale = teacher.voiceGender === 'female';

                return (
                  <div
                    key={teacher.id}
                    onClick={() => setSelectedTeacherId(teacher.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-2.5 relative group ${
                      isSelected
                        ? 'border-white/50 bg-white/15 ring-1 ring-white/30 shadow-xl scale-[1.02]'
                        : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={teacher.imageUrl}
                        alt={teacher.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover ring-1 ring-white/25 shadow-md"
                      />
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-[10px] font-mono text-amber-300 font-bold">
                        {idx + 1}
                      </span>
                      <span
                        className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          isFemale ? 'bg-pink-500/80 text-white' : 'bg-sky-500/80 text-white'
                        }`}
                      >
                        {isFemale ? '♀' : '♂'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-white">{teacher.name}</h4>
                      <span className="text-[10px] text-white/60 block">{teacher.role}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestVoice(teacher);
                      }}
                      className="mt-1 px-3 py-1 rounded-xl liquid-glass-pill text-[10px] text-white/90 hover:text-white flex items-center gap-1.5 transition-colors border border-white/18"
                    >
                      <Volume2 className="w-3 h-3 text-emerald-400" />
                      <span>Test Voice</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            {isSaved && (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 animate-[fadeIn_0.2s_ease] font-medium">
                <Check className="w-4 h-4 text-emerald-400" /> Preferences Saved Successfully!
              </span>
            )}

            <LiquidGlassButton
              variant="primary"
              size="md"
              onClick={(e: any) => handleSave(e)}
              icon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
              className="shadow-xl"
            >
              Save Student Profile
            </LiquidGlassButton>
          </div>
        </form>
      </div>
    </div>
  );
};
