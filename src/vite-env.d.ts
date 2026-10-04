/// <reference types="vite/client" />

interface ImportMeta {
  readonly env?: any;
}

declare module 'tesseract.js' {
  export const createWorker: any;
  export const PSM: any;
}
