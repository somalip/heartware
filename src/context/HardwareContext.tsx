import React, { createContext, useContext, useState, useEffect } from 'react';
import { HardwareState, ChamberConfig } from '../types';
import { hardwareService } from '../services/hardwareService';

interface HardwareContextType {
  state: HardwareState;
  connectBluetooth: (options?: { acceptAllDevices?: boolean }) => Promise<{ success: boolean; message: string }>;
  connectSimulated: (customMessage?: string) => { success: boolean; message: string };
  disconnect: () => void;
  readCharacteristicValue: () => Promise<string | null>;
  writeCharacteristicValue: (value: string) => Promise<{ success: boolean; message: string; response?: string }>;
  clearBleLogs: () => void;
  triggerDispense: (chamber: ChamberConfig, count?: number) => Promise<{ success: boolean; message: string; response?: string }>;
  triggerChainedDispense: (sequence: (1 | 2 | 3)[], bottleNames?: Record<number, string>) => Promise<{ success: boolean; message: string; response?: string }>;
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

  const connectBluetooth = async (options?: { acceptAllDevices?: boolean }) => {
    return await hardwareService.connectBluetooth(options);
  };

  const connectSimulated = (customMessage?: string) => {
    return hardwareService.connectSimulated(customMessage);
  };

  const disconnect = () => {
    hardwareService.disconnect();
  };

  const readCharacteristicValue = async () => {
    return await hardwareService.readCharacteristicValue();
  };

  const writeCharacteristicValue = async (value: string) => {
    return await hardwareService.writeCharacteristicValue(value);
  };

  const clearBleLogs = () => {
    hardwareService.clearBleLogs();
  };

  const triggerDispense = async (chamber: ChamberConfig, count: number = 1) => {
    return await hardwareService.triggerServoDispense(chamber, count);
  };

  const triggerChainedDispense = async (sequence: (1 | 2 | 3)[], bottleNames?: Record<number, string>) => {
    return await hardwareService.triggerChainedDispense(sequence, bottleNames);
  };

  const testCalibrateServo = async (servoId: number, angle: number) => {
    return await hardwareService.testCalibrateServo(servoId, angle);
  };

  return (
    <HardwareContext.Provider
      value={{
        state,
        connectBluetooth,
        connectSimulated,
        disconnect,
        readCharacteristicValue,
        writeCharacteristicValue,
        clearBleLogs,
        triggerDispense,
        triggerChainedDispense,
        testCalibrateServo
      }}
    >
      {children}
    </HardwareContext.Provider>
  );
};

export const useHardware = () => {
  const ctx = useContext(HardwareContext);
  if (!ctx) throw new Error('useHardware must be used within HardwareProvider');
  return ctx;
};
