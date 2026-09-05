import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TEACHERS } from '../data/teachers';
import { BrainCircuit, Sparkles, HelpCircle, CheckCircle, AlertTriangle, ArrowRight, RotateCcw, Volume2, Loader2, ArrowLeft } from 'lucide-react';
import { LearnerLevel, TeacherAvatar } from '../types';
import { selectVoiceForTeacher, testSpeakVoice } from '../utils/speechVoiceHelper';
import { LiquidGlassButton } from './LiquidGlassButton';

interface PracticeQuestion {
  id: string;
  question: string;
  scenario: string;
  options: string[];
  correctIndex: number;
  misconceptionAnalysis: {
    correctReason: string;
    distractorExplanations: string[];
  };
  hint: string;
  relatedConcept: string;
}

interface PracticePageProps {
  onBack?: () => void;
}

export const PracticePage: React.FC<PracticePageProps> = ({ onBack }) => {
  const { user } = useAuth();

  const [topic, setTopic] = useState('Newtonian Mechanics & Inertial Frames');
  const [level, setLevel] = useState<LearnerLevel>(user?.level || 'intermediate');
  const [language, setLanguage] = useState(user?.preferredLanguage || 'English');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherAvatar>(TEACHERS[5]); // Oleg Kravtsov (Diagnostic specialist)

  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleGenerateQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setSelectedIndex(null);
    setHasSubmitted(false);
    setShowHint(false);

    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          level,
          language,
          teacherName: selectedTeacher.name,
        }),
      });

      const data = await res.json();
      if (data.practice) {
        setQuestion(data.practice);
      }
    } catch (err) {
      console.error('Failed to generate practice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeakFeedback = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const match = selectVoiceForTeacher(
      voices,
      selectedTeacher.voiceGender,
      language,
      selectedTeacher.voicePitch,
      selectedTeacher.voiceRate
    );
    testSpeakVoice(match.voice, match.pitch, match.rate, text);
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/15">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-pill text-xs text-white/90 border border-white/20 mb-3 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono uppercase tracking-wider text-[11px] text-emerald-300">
                AI Cognitive Misconception Arena
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-normal tracking-tight text-white leading-tight">
              Adaptive Practice & Diagnostics
            </h1>
            <p className="mt-2 text-sm text-white/70 max-w-xl leading-relaxed">
              Zero static question banks. Every challenge is synthesized in real-time by AI to test deep conceptual understanding and pinpoint exact mental models.
            </p>
          </div>

          {/* Instructor indicator */}
          <div className="flex items-center gap-3.5 liquid-glass-card border border-white/18 p-3.5 rounded-2xl shadow-xl">
            <img
              src={selectedTeacher.imageUrl}
              alt={selectedTeacher.name}
              className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/25"
            />
            <div>
              <span className="text-[11px] text-white/50 block font-mono">Diagnostic Examiner</span>
              <span className="text-sm font-semibold text-white">{selectedTeacher.name}</span>
              <span className="text-xs text-emerald-400 block font-mono">
                {selectedTeacher.voiceGender === 'female' ? '♀ Female Voice' : '♂ Male Voice'}
              </span>
            </div>
          </div>
        </div>

        {/* Generator Controls */}
        <div className="liquid-glass-card border border-white/18 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
          <form onSubmit={handleGenerateQuestion} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-mono uppercase text-white/70 tracking-wider">
                  Target Topic to Practice
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Electromagnetic Induction, Dynamic Programming, Photosynthesis..."
                  className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/18 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30 transition-all shadow-inner"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-white/70 tracking-wider">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/18 text-xs text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/30"
                >
                  <option value="English" className="bg-zinc-900">English</option>
                  <option value="Hindi" className="bg-zinc-900">Hindi (हिंदी)</option>
                  <option value="Spanish" className="bg-zinc-900">Spanish (Español)</option>
                  <option value="French" className="bg-zinc-900">French (Français)</option>
                  <option value="German" className="bg-zinc-900">German (Deutsch)</option>
                  <option value="Russian" className="bg-zinc-900">Russian (Русский)</option>
                  <option value="Japanese" className="bg-zinc-900">Japanese (日本語)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60 font-mono">Difficulty:</span>
                {(['beginner', 'intermediate', 'advanced'] as LearnerLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize border transition-all ${
                      level === lvl
                        ? 'bg-white text-zinc-950 border-white shadow-[0_2px_10px_rgba(255,255,255,0.2)] font-semibold scale-[1.02]'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white/75 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <LiquidGlassButton
                variant="primary"
                size="md"
                onClick={(e: any) => handleGenerateQuestion(e)}
                disabled={isLoading}
                icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              >
                {isLoading ? 'Synthesizing Question...' : `Generate AI Question in ${language}`}
              </LiquidGlassButton>
            </div>
          </form>
        </div>

        {/* Question Area */}
        {question && (
          <div className="liquid-glass-card border border-white/18 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-2xl animate-[fadeIn_0.3s_ease-out]">
            {/* Question Scenario */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-300 bg-white/5 border border-white/15 px-3 py-1 rounded-full">
                  Concept: {question.relatedConcept}
                </span>
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="text-xs text-amber-300/90 hover:text-amber-300 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
                </button>
              </div>

              {showHint && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed font-mono">
                  💡 <strong>Hint:</strong> {question.hint}
                </div>
              )}

              {question.scenario && (
                <div className="p-4 rounded-2xl bg-black/40 border border-white/15 text-xs sm:text-sm text-white/85 leading-relaxed font-serif italic shadow-inner">
                  "{question.scenario}"
                </div>
              )}

              <h3 className="text-lg sm:text-xl font-medium text-white leading-snug">
                {question.question}
              </h3>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                const isSelected = selectedIndex === idx;
                const isCorrect = idx === question.correctIndex;

                let optionClass = 'border-white/15 hover:border-white/30 bg-white/[0.04] hover:bg-white/[0.09] text-white/90';
                if (hasSubmitted) {
                  if (isCorrect) {
                    optionClass = 'border-emerald-400 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400';
                  } else if (isSelected && !isCorrect) {
                    optionClass = 'border-rose-400 bg-rose-500/20 text-rose-100 ring-1 ring-rose-400';
                  } else {
                    optionClass = 'opacity-40 border-white/10 bg-transparent';
                  }
                } else if (isSelected) {
                  optionClass = 'border-white/50 bg-white/20 text-white ring-1 ring-white shadow-lg';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all text-xs sm:text-sm flex items-start gap-3.5 ${optionClass}`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-black/50 border border-white/20 flex items-center justify-center font-mono text-xs shrink-0 mt-0.5 font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 leading-relaxed">{opt}</span>
                    {hasSubmitted && isCorrect && (
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    {hasSubmitted && isSelected && !isCorrect && (
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Submit Action */}
            {!hasSubmitted ? (
              <div className="pt-2">
                <LiquidGlassButton
                  variant="primary"
                  size="lg"
                  disabled={selectedIndex === null}
                  onClick={() => setHasSubmitted(true)}
                  icon={<ArrowRight className="w-4 h-4" />}
                  className="w-full shadow-xl"
                >
                  Submit Diagnostic Answer
                </LiquidGlassButton>
              </div>
            ) : (
              <div className="pt-4 border-t border-white/15 space-y-4 animate-[fadeIn_0.3s_ease-out]">
                {/* Result Feedback Banner */}
                <div
                  className={`p-5 rounded-2xl border ${
                    selectedIndex === question.correctIndex
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100 shadow-lg'
                      : 'bg-amber-500/15 border-amber-400/40 text-amber-100 shadow-lg'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase font-bold tracking-wider">
                      {selectedIndex === question.correctIndex
                        ? '✓ Correct Reasoning'
                        : '⚠ Misconception Identified'}
                    </span>
                    <button
                      onClick={() =>
                        handleSpeakFeedback(
                          selectedIndex === question.correctIndex
                            ? question.misconceptionAnalysis.correctReason
                            : question.misconceptionAnalysis.distractorExplanations[selectedIndex!] ||
                              question.misconceptionAnalysis.correctReason
                        )
                      }
                      className="text-xs flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/15"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Hear Instructor</span>
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-white/95">
                    {selectedIndex === question.correctIndex
                      ? question.misconceptionAnalysis.correctReason
                      : question.misconceptionAnalysis.distractorExplanations[selectedIndex!] ||
                        `You selected an incorrect model. Correct principle: ${question.misconceptionAnalysis.correctReason}`}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <LiquidGlassButton
                    variant="primary"
                    size="md"
                    onClick={handleGenerateQuestion}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Next Adaptive Challenge
                  </LiquidGlassButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
