import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

// Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta?.env?.VITE_FIREBASE_API_KEY || "AIzaSyCvGEriFqIMvNJ5pZ4blUAt1MvuqrBa59M",
  authDomain: import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN || "heartware-caea7.firebaseapp.com",
  projectId: import.meta?.env?.VITE_FIREBASE_PROJECT_ID || "heartware-caea7",
  storageBucket: import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET || "heartware-caea7.firebasestorage.app",
  messagingSenderId: import.meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "726904171313",
  appId: import.meta?.env?.VITE_FIREBASE_APP_ID || "1:726904171313:web:1569af364df9377e069e10",
  measurementId: import.meta?.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-5V6XXER82H"
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let analyticsInstance: Analytics | null = null;

try {
  if (getApps().length > 0) {
    appInstance = getApps()[0];
  } else if (firebaseConfig.apiKey) {
    appInstance = initializeApp(firebaseConfig);
  }

  if (appInstance) {
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      try {
        analyticsInstance = getAnalytics(appInstance);
      } catch {
        // Analytics can fail in non-browser or adblocked environments
      }
    }
  }
} catch (error) {
  console.warn('[Firebase] Initialization warning:', error);
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;
export const analytics = analyticsInstance;
