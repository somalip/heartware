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
    bypassSafety?: boolean,
    count?: number
  ) => Promise<{ success: boolean; message: string; safetyEvaluation?: DispenseSafetyEvaluation; response?: string }>;
  dispenseChain: (
    sequence: (1 | 2 | 3)[],
    reason?: 'scheduled_auto' | 'app_trigger' | 'hardware_button' | 'manual_override',
    bypassSafety?: boolean
  ) => Promise<{ success: boolean; message: string; response?: string }>;
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
  logManualIntake: (data: {
    medicationName: string;
    pillStrength?: string;
    pillsDispensed: number;
    timestamp?: string;
    notes?: string;
    chamberId?: 1 | 2 | 3 | 4 | 0;
  }) => DispenseLog;
  deleteLog: (id: string) => void;
}

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export const MedicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { triggerDispense, triggerChainedDispense } = useHardware();
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
    bypassSafety = false,
    count = 1
  ): Promise<{ success: boolean; message: string; safetyEvaluation?: DispenseSafetyEvaluation; response?: string }> => {
    const chamber = chambers.find(c => c.servoId === chamberId);
    if (!chamber) {
      return { success: false, message: 'Invalid bottle ID requested' };
    }
    const pillCount = Math.max(1, count);
    if (chamber.currentCount < pillCount) {
      return {
        success: false,
        message: `Bottle ${chamberId} (${chamber.medicationName || 'Bottle ' + chamberId}) has only ${chamber.currentCount} pill${chamber.currentCount === 1 ? '' : 's'} remaining! Cannot dispense ${pillCount}.`
      };
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

    // Call hardware servo (sends single number "1", "2", "3" or repeated e.g. "11")
    const result = await triggerDispense(chamber, pillCount);

    if (result.success) {
      // Decrement pill count
      setChambers(prev =>
        prev.map(c => {
          if (c.servoId === chamberId) {
            const nextCount = Math.max(0, c.currentCount - pillCount);
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
        notes: `Dispensed ${pillCount} pill${pillCount > 1 ? 's' : ''} from Bottle #${chamberId}`,
        activeIngredients: ingredients,
        pillsDispensed: pillCount,
      });

      setLogs(prev => [newLog, ...prev]);
    }

    return result;
  };

  const dispenseChain = async (
    sequence: (1 | 2 | 3)[],
    reason: 'scheduled_auto' | 'app_trigger' | 'hardware_button' | 'manual_override' = 'app_trigger',
    bypassSafety = false
  ): Promise<{ success: boolean; message: string; response?: string }> => {
    if (!sequence.length) {
      return { success: false, message: 'No bottles selected in chain.' };
    }

    // Check inventory for each bottle in sequence
    const counts: Record<number, number> = {};
    for (const id of sequence) {
      counts[id] = (counts[id] || 0) + 1;
    }

    for (const [idStr, needed] of Object.entries(counts)) {
      const id = Number(idStr) as 1 | 2 | 3;
      const ch = chambers.find(c => c.servoId === id);
      if (!ch || ch.currentCount < needed) {
        return {
          success: false,
          message: `Bottle ${id} (${ch?.medicationName || `Bottle ${id}`}) has insufficient pills (${ch?.currentCount || 0} available, ${needed} required).`
        };
      }
    }

    // Pre-dispense safety checks if not bypassed
    if (!bypassSafety) {
      for (const [idStr] of Object.entries(counts)) {
        const id = Number(idStr) as 1 | 2 | 3;
        const evaluation = medicationSafetyService.validateDispenseSafety(id, chambers, logs);
        if (!evaluation.safeToDispense) {
          return {
            success: false,
            message: `Safety check failed for Bottle ${id}: ${evaluation.blockReason || evaluation.warnings[0] || 'Limit reached'}`,
          };
        }
      }
    }

    // Map names for display
    const bottleNames: Record<number, string> = {};
    chambers.forEach(c => {
      bottleNames[c.servoId] = c.medicationName;
    });

    // Call hardware service chained dispense (sends concatenated bottle digits e.g. "123")
    const result = await triggerChainedDispense(sequence, bottleNames);

    if (result.success) {
      // Decrement inventory
      setChambers(prev =>
        prev.map(c => {
          const used = counts[c.servoId] || 0;
          if (used > 0) {
            const nextCount = Math.max(0, c.currentCount - used);
            return {
              ...c,
              currentCount: nextCount,
              status: nextCount === 0 ? 'empty' : nextCount <= 4 ? 'low' : 'ready'
            };
          }
          return c;
        })
      );

      // Add log entries
      const newLogs: DispenseLog[] = [];
      for (const [idStr, used] of Object.entries(counts)) {
        const id = Number(idStr) as 1 | 2 | 3;
        const ch = chambers.find(c => c.servoId === id);
        const matched = ch ? findBestMatch(ch.medicationName) : null;
        const ingredients = ch?.activeIngredients || matched?.activeIngredients || [];

        const logEntry = storageService.addLog({
          timestamp: new Date().toISOString(),
          chamberId: id,
          medicationName: ch?.medicationName || `Bottle ${id}`,
          status: 'success',
          dispensedBy: reason,
          notes: `Chained dispense (${used} pill${used > 1 ? 's' : ''}, sequence: "${sequence.join('')}")`,
          activeIngredients: ingredients,
          pillsDispensed: used,
        });
        newLogs.push(logEntry);
      }

      setLogs(prev => [...newLogs, ...prev]);
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

  const logManualIntake = (data: {
    medicationName: string;
    pillStrength?: string;
    pillsDispensed: number;
    timestamp?: string;
    notes?: string;
    chamberId?: 1 | 2 | 3 | 4 | 0;
  }): DispenseLog => {
    // If associated with a chamber, or resolve ingredients from database
    const chamber = data.chamberId ? chambers.find(c => c.servoId === data.chamberId) : undefined;
    const matched = findBestMatch(data.medicationName);
    const ingredients = chamber?.activeIngredients?.length
      ? chamber.activeIngredients
      : matched?.activeIngredients || [];

    const newLog = storageService.addLog({
      timestamp: data.timestamp || new Date().toISOString(),
      chamberId: data.chamberId ?? 0,
      medicationName: data.medicationName,
      status: 'success',
      dispensedBy: 'manual_entry',
      notes: data.notes || (data.pillStrength ? `Strength: ${data.pillStrength}` : undefined),
      activeIngredients: ingredients,
      pillsDispensed: data.pillsDispensed || 1,
    });

    setLogs(prev => [newLog, ...prev]);

    // If logged against a dispenser chamber and currentCount > 0, decrement inventory
    if (data.chamberId && data.chamberId >= 1 && data.chamberId <= 4) {
      setChambers(prev =>
        prev.map(c => {
          if (c.servoId === data.chamberId) {
            const nextCount = Math.max(0, c.currentCount - (data.pillsDispensed || 1));
            return {
              ...c,
              currentCount: nextCount,
              status: nextCount === 0 ? 'empty' : nextCount <= 4 ? 'low' : 'ready',
            };
          }
          return c;
        })
      );
    }

    return newLog;
  };

  const deleteLog = (id: string) => {
    storageService.deleteLog(id);
    setLogs(prev => prev.filter(l => l.id !== id));
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
        dispenseChain,
        applyPrescriptionScan,
        calculateAdherenceRate,
        logManualIntake,
        deleteLog,
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
