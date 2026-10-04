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

export const app: any = null;
export const analytics: any = null;
export const auth: any = null;
export const db: any = null;
