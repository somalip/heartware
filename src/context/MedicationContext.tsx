import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChamberConfig, MedicationSchedule, DispenseLog } from '../types';
import { storageService } from '../services/storageService';
import { useHardware } from './HardwareContext';

interface MedicationContextType {
  chambers: ChamberConfig[];
  schedules: MedicationSchedule[];
  logs: DispenseLog[];
  refillChamber: (servoId: number, countToAdd: number) => void;
  updateChamberConfig: (servoId: number, changes: Partial<ChamberConfig>) => void;
  addSchedule: (schedule: Omit<MedicationSchedule, 'id'>) => void;
  updateSchedule: (id: string, changes: Partial<MedicationSchedule>) => void;
  deleteSchedule: (id: string) => void;
  dispenseNow: (chamberId: 1 | 2 | 3 | 4, reason?: 'scheduled_auto' | 'app_trigger' | 'hardware_button') => Promise<{ success: boolean; message: string }>;
  calculateAdherenceRate: () => number;
}

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export const MedicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { triggerDispense } = useHardware();
  const [chambers, setChambers] = useState<ChamberConfig[]>(() => storageService.getChambers());
  const [schedules, setSchedules] = useState<MedicationSchedule[]>(() => storageService.getSchedules());
  const [logs, setLogs] = useState<DispenseLog[]>(() => storageService.getLogs());

  useEffect(() => {
    storageService.saveChambers(chambers);
  }, [chambers]);

  useEffect(() => {
    storageService.saveSchedules(schedules);
  }, [schedules]);

  const refillChamber = (servoId: number, countToAdd: number) => {
    setChambers(prev =>
      prev.map(c => {
        if (c.servoId === servoId) {
          const nextCount = Math.min(c.maxCapacity, c.currentCount + countToAdd);
          return {
            ...c,
            currentCount: nextCount,
            status: nextCount > 5 ? 'ready' : 'low'
          };
        }
        return c;
      })
    );
  };

  const updateChamberConfig = (servoId: number, changes: Partial<ChamberConfig>) => {
    setChambers(prev =>
      prev.map(c => (c.servoId === servoId ? { ...c, ...changes } : c))
    );
  };

  const addSchedule = (schedule: Omit<MedicationSchedule, 'id'>) => {
    const newSch: MedicationSchedule = {
      ...schedule,
      id: `sch-${Date.now()}`
    };
    setSchedules(prev => [...prev, newSch]);
  };

  const updateSchedule = (id: string, changes: Partial<MedicationSchedule>) => {
    setSchedules(prev => prev.map(s => (s.id === id ? { ...s, ...changes } : s)));
  };

  const deleteSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const dispenseNow = async (
    chamberId: 1 | 2 | 3 | 4,
    reason: 'scheduled_auto' | 'app_trigger' | 'hardware_button' = 'app_trigger'
  ) => {
    const chamber = chambers.find(c => c.servoId === chamberId);
    if (!chamber) {
      return { success: false, message: 'Invalid chamber ID requested' };
    }
    if (chamber.currentCount <= 0) {
      return { success: false, message: `Chamber ${chamberId} (${chamber.medicationName}) is empty! Refill required.` };
    }

    // Call hardware servo
    const result = await triggerDispense(chamber);

    if (result.success) {
      // Decrement pill count
      setChambers(prev =>
        prev.map(c => {
          if (c.servoId === chamberId) {
            const nextCount = Math.max(0, c.currentCount - 1);
            return {
              ...c,
              currentCount: nextCount,
              status: nextCount === 0 ? 'empty' : nextCount <= 4 ? 'low' : 'ready'
            };
          }
          return c;
        })
      );

      // Record log
      const newLog = storageService.addLog({
        timestamp: new Date().toISOString(),
        chamberId,
        medicationName: chamber.medicationName,
        status: 'success',
        dispensedBy: reason,
        notes: `Dispensed 1 pill from Servo #${chamberId}`
      });

      setLogs(prev => [newLog, ...prev]);
    }

    return result;
  };

  const calculateAdherenceRate = (): number => {
    if (logs.length === 0) return 96;
    const successes = logs.filter(l => l.status === 'success').length;
    return Math.round((successes / logs.length) * 100);
  };

  return (
    <MedicationContext.Provider
      value={{
        chambers,
        schedules,
        logs,
        refillChamber,
        updateChamberConfig,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        dispenseNow,
        calculateAdherenceRate
      }}
    >
      {children}
    </MedicationContext.Provider>
  );
};

export const useMedication = () => {
  const ctx = useContext(MedicationContext);
  if (!ctx) throw new Error('useMedication must be used within MedicationProvider');
  return ctx;
};
