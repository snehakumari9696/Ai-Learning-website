import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, LearnerLevel } from '../types';
import { getProfile, updateProfile as updateProfileApi } from '../services/api';

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  login: (email: string, name?: string, level?: LearnerLevel, language?: string) => void;
  loginAsGuest: () => void;
  logout: () => void;
  updateUserProfile: (updates: Partial<UserSession>) => void;
  isAuthModalOpen: boolean;
  openAuthModal: (redirectRoute?: string) => void;
  closeAuthModal: () => void;
  pendingRedirect: string | null;
  clearPendingRedirect: () => void;
}

const STORAGE_KEY = 'echomind_user_session_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Initialize session from localStorage and sync with backend
  useEffect(() => {
    const initSession = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedSession = JSON.parse(stored);
          setUser(parsedSession);

          // If not guest, fetch latest from DB
          if (!parsedSession.isGuest) {
            const dbProfile = await getProfile(parsedSession.id);
            if (dbProfile) {
              const updatedSession = {
                ...parsedSession,
                name: dbProfile.fullName || parsedSession.name,
                level: dbProfile.masteryLevel || parsedSession.level,
                preferredLanguage: dbProfile.preferredLanguage || parsedSession.preferredLanguage,
                preferredTeacherId: dbProfile.preferredTeacherId || parsedSession.preferredTeacherId,
              };
              setUser(updatedSession);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
            }
          }
        }
      } catch (err) {
        console.warn('Could not read user session from storage', err);
      }
    };
    initSession();
  }, []);

  const login = (
    email: string,
    name: string = 'Learner',
    level: LearnerLevel = 'intermediate',
    language: string = 'English'
  ) => {
    const session: UserSession = {
      id: `usr_${Date.now()}`,
      name: name.trim() || 'Alex Mercer',
      email: email.trim(),
      level,
      primarySubject: 'STEM & Computer Science',
      preferredLanguage: language,
      preferredTeacherId: 'elena-baranova',
      isGuest: false,
      createdAt: new Date().toISOString(),
    };
    
    // Also save this user to Postgres
    updateProfileApi(session.id, {
      name: session.name,
      email: session.email,
      level: session.level,
      preferredLanguage: session.preferredLanguage,
      preferredTeacherId: session.preferredTeacherId
    }).then(() => {
      setUser(session);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (err) {
        console.error(err);
      }
    }).catch(console.error);
    
    setIsAuthModalOpen(false);
  };

  const loginAsGuest = () => {
    const session: UserSession = {
      id: `guest_${Date.now()}`,
      name: 'Guest Scholar',
      email: 'scholar@echomind.ai',
      level: 'intermediate',
      primarySubject: 'Physics & Applied Mathematics',
      preferredLanguage: 'English',
      preferredTeacherId: 'elena-baranova',
      isGuest: true,
      createdAt: new Date().toISOString(),
    };
    setUser(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.error(err);
    }
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error(err);
    }
  };

  const updateUserProfile = (updates: Partial<UserSession>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  const openAuthModal = (redirectRoute?: string) => {
    if (redirectRoute) {
      setPendingRedirect(redirectRoute);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const clearPendingRedirect = () => {
    setPendingRedirect(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        loginAsGuest,
        logout,
        updateUserProfile,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        pendingRedirect,
        clearPendingRedirect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
