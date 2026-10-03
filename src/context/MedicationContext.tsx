import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChamberConfig, MedicationSchedule, DispenseLog, ActiveIngredient, DispenseSafetyEvaluation } from '../types';
import { storageService } from '../services/storageService';
import { useHardware } from './HardwareContext';
import { medicationSafetyService } from '../services/medicationSafetyService';
import { findBestMatch } from '../data/medicationDatabase';

interface MedicationContextType {
  chambers: ChamberConfig[];
  schedules: MedicationSchedule[];
  logs: DispenseLog[];
  refillChamber: (servoId: number, countToAdd: number) => void;
  updateChamberConfig: (servoId: number, changes: Partial<ChamberConfig>) => void;
  addSchedule: (schedule: Omit<MedicationSchedule, 'id'>) => void;
  updateSchedule: (id: string, changes: Partial<MedicationSchedule>) => void;
  deleteSchedule: (id: string) => void;
  dispenseNow: (
    chamberId: 1 | 2 | 3 | 4,
    reason?: 'scheduled_auto' | 'app_trigger' | 'hardware_button' | 'manual_override',
    bypassSafety?: boolean
  ) => Promise<{ success: boolean; message: string; safetyEvaluation?: DispenseSafetyEvaluation }>;
  applyPrescriptionScan: (data: {
    slotId: 1 | 2 | 3 | 4;
    medicationName: string;
    pillStrength: string;
    activeIngredients: ActiveIngredient[];
    maxDailyDoses: number;
    dosage: string;
    times: string[];
    instructions: string;
    prescribedBy: string;
  }) => void;
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
    reason: 'scheduled_auto' | 'app_trigger' | 'hardware_button' | 'manual_override' = 'app_trigger',
    bypassSafety = false
  ): Promise<{ success: boolean; message: string; safetyEvaluation?: DispenseSafetyEvaluation }> => {
    const chamber = chambers.find(c => c.servoId === chamberId);
    if (!chamber) {
      return { success: false, message: 'Invalid chamber ID requested' };
    }
    if (chamber.currentCount <= 0) {
      return { success: false, message: `Chamber ${chamberId} (${chamber.medicationName || 'Slot ' + chamberId}) is empty! Refill required.` };
    }

    // Pre-dispense safety check
    if (!bypassSafety) {
      const evaluation = medicationSafetyService.validateDispenseSafety(chamberId, chambers, logs);
      if (!evaluation.safeToDispense) {
        return {
          success: false,
          message: evaluation.blockReason || evaluation.warnings[0] || 'Safety limits exceeded',
          safetyEvaluation: evaluation,
        };
      }
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

      // Record log with active ingredients for cumulative safety tracking
      const matched = findBestMatch(chamber.medicationName);
      const ingredients = chamber.activeIngredients || matched?.activeIngredients || [];

      const newLog = storageService.addLog({
        timestamp: new Date().toISOString(),
        chamberId,
        medicationName: chamber.medicationName,
        status: 'success',
        dispensedBy: reason,
        notes: `Dispensed 1 pill from Servo #${chamberId}`,
        activeIngredients: ingredients,
        pillsDispensed: 1,
      });

      setLogs(prev => [newLog, ...prev]);
    }

    return result;
  };

  const applyPrescriptionScan = (data: {
    slotId: 1 | 2 | 3 | 4;
    medicationName: string;
    pillStrength: string;
    activeIngredients: ActiveIngredient[];
    maxDailyDoses: number;
    dosage: string;
    times: string[];
    instructions: string;
    prescribedBy: string;
  }) => {
    // 1. Update chamber config
    setChambers(prev =>
      prev.map(c => {
        if (c.servoId === data.slotId) {
          return {
            ...c,
            medicationName: data.medicationName,
            pillStrength: data.pillStrength,
            activeIngredients: data.activeIngredients,
            maxDailyDoses: data.maxDailyDoses,
            currentCount: c.currentCount > 0 ? c.currentCount : 20,
            status: 'ready' as const,
          };
        }
        return c;
      })
    );

    // 2. Add or update schedule routine
    setSchedules(prev => {
      const existing = prev.find(s => s.chamberId === data.slotId);
      if (existing) {
        return prev.map(s =>
          s.id === existing.id
            ? {
                ...s,
                medicationName: data.medicationName,
                dosage: data.dosage,
                times: data.times,
                instructions: data.instructions,
                prescribedBy: data.prescribedBy,
                activeIngredients: data.activeIngredients,
                maxDailyDoses: data.maxDailyDoses,
              }
            : s
        );
      } else {
        const newSch: MedicationSchedule = {
          id: `sch-${Date.now()}`,
          chamberId: data.slotId,
          medicationName: data.medicationName,
          dosage: data.dosage,
          times: data.times,
          instructions: data.instructions,
          prescribedBy: data.prescribedBy,
          active: true,
          shape: 'capsule',
          pillColor: '#007aff',
          activeIngredients: data.activeIngredients,
          maxDailyDoses: data.maxDailyDoses,
        };
        return [...prev, newSch];
      }
    });
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
        applyPrescriptionScan,
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
