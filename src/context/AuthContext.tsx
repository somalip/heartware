import React, { createContext, useContext, useState } from 'react';
import { UserProfile, UserRole } from '../types';

/**
 * Local-only accounts. Passwords are SHA-256 hashed and stored in localStorage
 * on this device. Swap this file for a real backend (Firebase, Supabase, etc.)
 * before handling real patient data.
 */

interface Account {
  email: string;
  passwordHash: string;
  profile: UserProfile;
}

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (input: RegisterInput) => Promise<string | null>;
  logout: () => void;
  updateProfile: (fields: Partial<UserProfile>) => void;
}

const ACCOUNTS_KEY = 'heartware_accounts';
const SESSION_KEY = 'heartware_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readAccounts = (): Account[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
};
const writeAccounts = (a: Account[]) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));

async function hash(text: string): Promise<string> {
  if (!crypto?.subtle) throw new Error('Open the app over HTTPS or localhost to sign in.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const normalize = (email: string) => email.trim().toLowerCase();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const email = localStorage.getItem(SESSION_KEY);
    return readAccounts().find((a) => a.email === email)?.profile ?? null;
  });

  const startSession = (profile: UserProfile) => {
    localStorage.setItem(SESSION_KEY, profile.email);
    setUser(profile);
  };

  const login = async (email: string, password: string) => {
    try {
      const account = readAccounts().find((a) => a.email === normalize(email));
      if (!account || account.passwordHash !== (await hash(password))) return 'Wrong email or password.';
      startSession(account.profile);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const register = async ({ name, email, password, role }: RegisterInput) => {
    try {
      const accounts = readAccounts();
      const key = normalize(email);
      if (accounts.some((a) => a.email === key)) return 'An account with that email already exists.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
      const profile: UserProfile = {
        id: `usr-${Date.now()}`,
        name: name.trim(),
        role,
        email: key,
        emergencyContact: { name: '', phone: '' },
      };
      writeAccounts([...accounts, { email: key, passwordHash: await hash(password), profile }]);
      startSession(profile);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const updateProfile = (fields: Partial<UserProfile>) => {
    if (!user) return;
    const profile = { ...user, ...fields, email: user.email };
    writeAccounts(readAccounts().map((a) => (a.email === user.email ? { ...a, profile } : a)));
    setUser(profile);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
