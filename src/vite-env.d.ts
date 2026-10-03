/// <reference types="vite/client" />

declare module 'firebase/app' {
  export function initializeApp(config: Record<string, unknown>): any;
}

declare module 'firebase/analytics' {
  export function getAnalytics(app: any): any;
}

declare module 'firebase/auth' {
  export function getAuth(app: any): any;
}

declare module 'firebase/firestore' {
  export function getFirestore(app: any): any;
}
