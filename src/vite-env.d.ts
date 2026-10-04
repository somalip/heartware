/// <reference types="vite/client" />

interface ImportMeta {
  readonly env?: any;
}

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

declare module 'firebase/vertexai' {
  export const getVertexAI: any;
  export const getGenerativeModel: any;
}

declare module 'tesseract.js' {
  export const createWorker: any;
  export const PSM: any;
}
