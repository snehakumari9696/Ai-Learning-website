import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageRoute } from '../types';
import {
  Sparkles,
  Video,
  BookOpen,
  BrainCircuit,
  Library,
  User as UserIcon,
  LogOut,
  Lock,
  Globe,
  ArrowLeft,
} from 'lucide-react';

interface NavbarProps {
  currentRoute: PageRoute;
  onRouteChange: (route: PageRoute) => void;
  activeLanguage: string;
  onLanguageChange?: (lang: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onRouteChange,
  activeLanguage,
  onLanguageChange,
}) => {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  const handleNavClick = (route: PageRoute, featureTitle: string) => {
    if (route === 'home') {
      onRouteChange('home');
      return;
    }

    if (!isAuthenticated) {
      openAuthModal(featureTitle);
      return;
    }

    onRouteChange(route);
  };

  const navItems: { route: PageRoute; label: string; icon: React.ReactNode; protected: boolean }[] = [
    { route: 'home', label: 'Home', icon: <Sparkles className="w-3.5 h-3.5" />, protected: false },
    { route: 'classroom', label: 'Live Classroom', icon: <Video className="w-3.5 h-3.5" />, protected: true },
    { route: 'curriculum', label: 'AI Curriculum', icon: <BookOpen className="w-3.5 h-3.5" />, protected: true },
    { route: 'practice', label: 'Practice Arena', icon: <BrainCircuit className="w-3.5 h-3.5" />, protected: true },
    { route: 'library', label: 'Study Library', icon: <Library className="w-3.5 h-3.5" />, protected: true },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/10 font-geist text-white select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left Section: Brand Logo + Back Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onRouteChange('home')}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity text-left shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-[#020617] rounded-[10px] flex items-center justify-center">
                <span className="font-bold text-xs tracking-wider bg-gradient-to-tr from-emerald-400 to-sky-300 bg-clip-text text-transparent">
                  K
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-white">ECHOMIND</span>
                <span className="hidden sm:inline-block text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-emerald-400 border border-white/10">
                  AI Teacher
                </span>
              </div>
            </div>
          </button>

          {/* Dedicated prominent Back to Home button when browsing other pages */}
          {currentRoute !== 'home' && (
            <button
              type="button"
              onClick={() => onRouteChange('home')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all shadow-sm hover:scale-[1.02]"
              title="Return to Home Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Back to Home</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-2xl backdrop-blur-md">
          {navItems.map((item) => {
            const isActive = currentRoute === item.route;
            const isLocked = item.protected && !isAuthenticated;

            return (
              <button
                key={item.route}
                onClick={() => handleNavClick(item.route, item.label)}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-zinc-950 shadow font-semibold'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {isLocked && <Lock className="w-3 h-3 text-white/40 ml-0.5" />}
              </button>
            );
          })}
        </nav>

        {/* Right Action: Language + User Auth state */}
        <div className="flex items-center gap-2.5">
          {/* Language Indicator */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-medium text-white">{activeLanguage}</span>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRouteChange('profile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                  currentRoute === 'profile'
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center text-[10px] font-bold text-emerald-300">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate font-medium">{user.name}</span>
                {user.isGuest && (
                  <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Demo
                  </span>
                )}
              </button>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 text-white/60 hover:text-rose-400 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('Sign In')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-white/80 hover:text-white hover:bg-white/5 transition-all"
              >
                Sign In
              </button>

              <button
                onClick={() => openAuthModal('Instant Demo')}
                className="px-3.5 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-white/90 text-xs font-semibold shadow-md transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Get Started</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav sub-bar */}
      <div className="md:hidden border-t border-white/10 px-4 py-2 flex items-center justify-around bg-black/40">
        {navItems.map((item) => {
          const isActive = currentRoute === item.route;
          const isLocked = item.protected && !isAuthenticated;

          return (
            <button
              key={item.route}
              onClick={() => handleNavClick(item.route, item.label)}
              className={`p-2 text-xs flex flex-col items-center gap-1 ${
                isActive ? 'text-white font-semibold' : 'text-white/60'
              }`}
            >
              <div className="relative">
                {item.icon}
                {isLocked && <Lock className="w-2.5 h-2.5 text-white/40 absolute -top-1 -right-1" />}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
