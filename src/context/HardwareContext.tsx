import React, { createContext, useContext, useState, useEffect } from 'react';
import { HardwareState, ChamberConfig } from '../types';
import { hardwareService } from '../services/hardwareService';

interface HardwareContextType {
  state: HardwareState;
  connectBluetooth: () => Promise<{ success: boolean; message: string }>;
  disconnect: () => void;
  triggerDispense: (chamber: ChamberConfig) => Promise<{ success: boolean; message: string }>;
  testCalibrateServo: (servoId: number, angle: number) => Promise<string>;
}

const HardwareContext = createContext<HardwareContextType | undefined>(undefined);

export const HardwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<HardwareState>(hardwareService.getState());

  useEffect(() => {
    const unsubscribe = hardwareService.subscribe(newState => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const connectBluetooth = async () => {
    return await hardwareService.connectBluetooth();
  };

  const disconnect = () => {
    hardwareService.disconnect();
  };

  const triggerDispense = async (chamber: ChamberConfig) => {
    return await hardwareService.triggerServoDispense(chamber);
  };

  const testCalibrateServo = async (servoId: number, angle: number) => {
    return await hardwareService.testCalibrateServo(servoId, angle);
  };

  return (
    <HardwareContext.Provider value={{ state, connectBluetooth, disconnect, triggerDispense, testCalibrateServo }}>
      {children}
    </HardwareContext.Provider>
  );
};

export const useHardware = () => {
  const ctx = useContext(HardwareContext);
  if (!ctx) throw new Error('useHardware must be used within HardwareProvider');
  return ctx;
};
