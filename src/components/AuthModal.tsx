import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LearnerLevel } from '../types';
import { X, Lock, Sparkles, User, Mail, Key, Globe, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  featureName?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, featureName }) => {
  const { login, loginAsGuest } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState<LearnerLevel>('intermediate');
  const [language, setLanguage] = useState('English');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password.trim() || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (tab === 'signup' && !name.trim()) {
      setError('Please enter your full name or nickname.');
      return;
    }

    login(email, tab === 'signup' ? name : email.split('@')[0], level, language);
    if (onSuccess) onSuccess();
    onClose();
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-md bg-zinc-950 border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden font-geist text-white">
        {/* Glow backdrop effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-white/60 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-mono tracking-wider uppercase text-emerald-400">Authentication Required</span>
            <h2 className="text-xl font-medium tracking-tight text-white">
              {tab === 'signin' ? 'Sign In to EchoMind' : 'Create Student Account'}
            </h2>
          </div>
        </div>

        {/* Dynamic prompt message based on intercepted feature */}
        <div className="mb-5 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/80 leading-relaxed flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <span>
            {featureName ? (
              <>
                To access <strong className="text-white font-medium">{featureName}</strong> and generate personalized AI lessons, please sign in or try the instant demo.
              </>
            ) : (
              'Sign in to unlock interactive AI video classroom, adaptive diagnostics, and personalized curriculum generation.'
            )}
          </span>
        </div>

        {/* Tab Toggle */}
        <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 mb-5">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
              tab === 'signin' ? 'bg-white text-black shadow-md font-semibold' : 'text-white/70 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
              tab === 'signup' ? 'bg-white text-black shadow-md font-semibold' : 'text-white/70 hover:text-white'
            }`}
          >
            New Account
          </button>
        </div>

        {/* Error notice */}
        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Full Name / Preferred Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/80 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/80 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Password</label>
            <div className="relative">
              <Key className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-400/80 transition-colors"
              />
            </div>
          </div>

          {tab === 'signup' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Preferred Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as LearnerLevel)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400/80"
                >
                  <option value="beginner" className="bg-zinc-900 text-white">Beginner</option>
                  <option value="intermediate" className="bg-zinc-900 text-white">Intermediate</option>
                  <option value="advanced" className="bg-zinc-900 text-white">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-400" /> Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400/80"
                >
                  <option value="English" className="bg-zinc-900 text-white">English</option>
                  <option value="Hindi" className="bg-zinc-900 text-white">Hindi (हिंदी)</option>
                  <option value="Spanish" className="bg-zinc-900 text-white">Spanish (Español)</option>
                  <option value="French" className="bg-zinc-900 text-white">French (Français)</option>
                  <option value="German" className="bg-zinc-900 text-white">German (Deutsch)</option>
                  <option value="Russian" className="bg-zinc-900 text-white">Russian (Русский)</option>
                  <option value="Japanese" className="bg-zinc-900 text-white">Japanese (日本語)</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-2 py-3 rounded-2xl bg-white text-zinc-950 hover:bg-white/90 font-medium text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <span>{tab === 'signin' ? 'Sign In & Enter' : 'Create & Launch'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Instant Demo Login */}
        <div className="mt-5 pt-5 border-t border-white/10">
          <button
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/90 font-medium transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Continue as Guest Scholar (1-Click Instant Demo)</span>
          </button>
          <p className="mt-2 text-[11px] text-white/50 text-center">
            Zero setup required • Instant preview of all AI learning features
          </p>
        </div>
      </div>
    </div>
  );
};
