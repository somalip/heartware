import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { triggerHaptic } from '../utils/haptics';

type ToastType = 'success' | 'info' | 'warning' | 'error';

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<number | null>(null);
  const counterRef = useRef(0);

  const showToast = (message: string, type: ToastType = 'info') => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    const id = ++counterRef.current;
    
    // Auto-detect type if default
    let resolvedType = type;
    if (type === 'info') {
      const lower = message.toLowerCase();
      if (lower.includes('error') || lower.includes('fail') || lower.includes('empty')) {
        resolvedType = 'error';
      } else if (lower.includes('removed') || lower.includes('reset') || lower.includes('disconnect')) {
        resolvedType = 'warning';
      } else if (lower.includes('success') || lower.includes('dispensed') || lower.includes('connected') || lower.includes('saved') || lower.includes('updated') || lower.includes('refill') || lower.includes('added') || lower.includes('created') || lower.includes('signed in')) {
        resolvedType = 'success';
      }
    }

    triggerHaptic(resolvedType === 'error' ? 'warning' : 'light');
    setToast({ id, message, type: resolvedType });

    timerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const dismiss = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className={`app-toast ios-island-hud ${toast.type}`}
          role="status"
          onClick={dismiss}
          title="Dismiss"
        >
          <div className="ios-island-content">
            <span className="ios-island-icon">
              {toast.type === 'success' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {toast.type === 'warning' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </span>
            <span className="ios-island-text">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
