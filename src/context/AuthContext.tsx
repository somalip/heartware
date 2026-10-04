import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../services/firebase.ts';
import { firebaseSyncService } from '../services/firebaseSyncService.ts';
import { UserProfile, UserRole } from '../types/index.ts';

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
  isFirebaseConnected: boolean;
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
  if (!crypto?.subtle) return text;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const normalize = (email: string) => email.trim().toLowerCase();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      // If full profile JSON is cached
      if (raw.startsWith('{')) {
        return JSON.parse(raw);
      }
      return readAccounts().find((a) => normalize(a.email) === normalize(raw))?.profile ?? null;
    } catch {
      return null;
    }
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(Boolean(auth));

  // Sync session with Firebase Auth state
  useEffect(() => {
    if (!auth) {
      setIsFirebaseConnected(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsFirebaseConnected(true);
      if (firebaseUser) {
        // Try fetching user profile from Firestore
        const remoteProfile = await firebaseSyncService.fetchUserProfile(firebaseUser.uid);
        if (remoteProfile) {
          setUser(remoteProfile);
          localStorage.setItem(SESSION_KEY, JSON.stringify(remoteProfile));
        } else if (!user) {
          // Construct profile from Firebase auth
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            role: 'patient',
            email: firebaseUser.email || '',
            emergencyContact: { name: '', phone: '' },
          };
          setUser(newProfile);
          localStorage.setItem(SESSION_KEY, JSON.stringify(newProfile));
          await firebaseSyncService.syncUserProfile(firebaseUser.uid, newProfile);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const startSession = (profile: UserProfile) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    setUser(profile);
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    const normEmail = normalize(email);
    let authError: string | null = null;

    // 1. Try Firebase Authentication first if available
    if (auth) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, normEmail, password);
        const fbUser = userCredential.user;
        const remoteProfile = await firebaseSyncService.fetchUserProfile(fbUser.uid);

        const profile: UserProfile = remoteProfile || {
          id: fbUser.uid,
          name: fbUser.displayName || normEmail.split('@')[0],
          role: 'patient',
          email: normEmail,
          emergencyContact: { name: '', phone: '' },
        };

        startSession(profile);
        await firebaseSyncService.syncUserProfile(fbUser.uid, profile);
        return null;
      } catch (err: any) {
        console.warn('[Firebase Auth] Sign in notice:', err.code, err.message);
        authError = err.message;
        // Continue to fallback local check if offline or network error
      }
    }

    // 2. Offline / Local fallback check
    try {
      const accounts = readAccounts();
      const account = accounts.find((a) => normalize(a.email) === normEmail);
      if (account && account.passwordHash === (await hash(password))) {
        startSession(account.profile);
        return null;
      }
    } catch {
      // Local check failed
    }

    return authError || 'Wrong email or password.';
  };

  const register = async ({ name, email, password, role }: RegisterInput): Promise<string | null> => {
    const normEmail = normalize(email);
    if (password.length < 6) return 'Password must be at least 6 characters.';

    let createdUid = `usr-${Date.now()}`;
    let firebaseRegistered = false;

    // 1. Try registering with Firebase Auth
    if (auth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, normEmail, password);
        createdUid = userCredential.user.uid;
        firebaseRegistered = true;
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          // If already in Firebase, try logging in
          const loginErr = await login(normEmail, password);
          if (!loginErr) return null;
          return 'An account with that email already exists in Firebase.';
        }
        console.warn('[Firebase Auth] Registration warning:', err.code, err.message);
      }
    }

    // 2. Local fallback registration
    const accounts = readAccounts();
    if (!firebaseRegistered && accounts.some((a) => normalize(a.email) === normEmail)) {
      return 'An account with that email already exists.';
    }

    const profile: UserProfile = {
      id: createdUid,
      name: name.trim(),
      role,
      email: normEmail,
      emergencyContact: { name: '', phone: '' },
    };

    // Save locally
    const pwdHash = await hash(password);
    writeAccounts([...accounts.filter((a) => normalize(a.email) !== normEmail), { email: normEmail, passwordHash: pwdHash, profile }]);
    startSession(profile);

    // Sync to Firestore
    await firebaseSyncService.syncUserProfile(createdUid, profile);

    return null;
  };

  const logout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn('[Firebase Auth] Signout warning:', e);
      }
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const updateProfile = async (fields: Partial<UserProfile>) => {
    if (!user) return;
    const profile = { ...user, ...fields, email: user.email };
    writeAccounts(readAccounts().map((a) => (normalize(a.email) === normalize(user.email) ? { ...a, profile } : a)));
    startSession(profile);

    // Sync to Firestore
    await firebaseSyncService.syncUserProfile(profile.id, profile);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile, isFirebaseConnected }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
