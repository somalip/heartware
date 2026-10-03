import React, { createContext, useContext, useState, ReactNode } from 'react';
import { triggerHaptic } from '../utils/haptics';

export interface AlertAction {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertConfig {
  title: string;
  message?: string;
  actions: AlertAction[];
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
  showConfirm: (options: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => Promise<boolean>;
  closeAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeAlert, setActiveAlert] = useState<AlertConfig | null>(null);

  const showAlert = (config: AlertConfig) => {
    triggerHaptic('medium');
    setActiveAlert(config);
  };

  const closeAlert = () => {
    setActiveAlert(null);
  };

  const showConfirm = ({
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
    isDestructive = false,
  }: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      showAlert({
        title,
        message,
        actions: [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: confirmText,
            style: isDestructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ],
      });
    });
  };

  const handleActionClick = (action: AlertAction) => {
    triggerHaptic('selection');
    closeAlert();
    if (action.onPress) {
      action.onPress();
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, closeAlert }}>
      {children}
      {activeAlert && (
        <div className="ios-alert-overlay" onClick={closeAlert}>
          <div className="ios-alert-dialog" role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <div className="ios-alert-content">
              <h2 className="ios-alert-title">{activeAlert.title}</h2>
              {activeAlert.message && (
                <p className="ios-alert-message">{activeAlert.message}</p>
              )}
            </div>

            <div
              className={`ios-alert-actions ${
                activeAlert.actions.length === 2 ? 'split' : 'stack'
              }`}
            >
              {activeAlert.actions.map((act, index) => {
                const isDestructive = act.style === 'destructive';
                const isCancel = act.style === 'cancel';

                return (
                  <button
                    key={index}
                    type="button"
                    className={`ios-alert-btn ${isDestructive ? 'destructive' : ''} ${
                      isCancel ? 'cancel' : ''
                    }`}
                    onClick={() => handleActionClick(act)}
                  >
                    {act.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
};
