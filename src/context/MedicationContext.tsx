import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ChamberConfig, MedicationSchedule, DispenseLog, ActiveIngredient, DispenseSafetyEvaluation } from '../types/index.ts';
import { storageService } from '../services/storageService.ts';
import { useHardware } from './HardwareContext.tsx';
import { useAuth } from './AuthContext.tsx';
import { medicationSafetyService } from '../services/medicationSafetyService.ts';
import { findBestMatch } from '../data/medicationDatabase.ts';
import { firebaseSyncService } from '../services/firebaseSyncService.ts';

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
  clearLogs: () => void;
  seedSampleLogs: () => void;
  loadDemoPrescription: () => void;
  setChamberInventory: (servoId: number, count: number) => void;
  syncWithCloudNow: () => Promise<void>;
}

const MedicationContext = createContext<MedicationContextType | undefined>(undefined);

export const MedicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { triggerDispense, triggerChainedDispense } = useHardware();
  const [chambers, setChambers] = useState<ChamberConfig[]>(() => storageService.getChambers());
  const [schedules, setSchedules] = useState<MedicationSchedule[]>(() => storageService.getSchedules());
  const [logs, setLogs] = useState<DispenseLog[]>(() => storageService.getLogs());

  // Prevent initial load loops
  const isHydratingFromCloud = useRef(false);

  // Sync to local storage whenever state changes
  useEffect(() => {
    storageService.saveChambers(chambers);
    if (user?.id && !isHydratingFromCloud.current) {
      firebaseSyncService.syncChambers(user.id, chambers);
    }
  }, [chambers, user?.id]);

  useEffect(() => {
    storageService.saveSchedules(schedules);
    if (user?.id && !isHydratingFromCloud.current) {
      firebaseSyncService.syncSchedules(user.id, schedules);
    }
  }, [schedules, user?.id]);

  // Firebase Realtime Subscriptions per user
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    let unsubChambers: (() => void) | null = null;
    let unsubSchedules: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;

    const hydrateAndListen = async () => {
      isHydratingFromCloud.current = true;
      try {
        // Initial Fetch
        const [cloudChambers, cloudSchedules, cloudLogs] = await Promise.all([
          firebaseSyncService.fetchChambers(uid),
          firebaseSyncService.fetchSchedules(uid),
          firebaseSyncService.fetchLogs(uid),
        ]);

        if (cloudChambers && cloudChambers.length > 0) {
          setChambers(cloudChambers);
          storageService.saveChambers(cloudChambers);
        } else {
          // First time syncing this user - upload local initial state
          await firebaseSyncService.syncChambers(uid, storageService.getChambers());
        }

        if (cloudSchedules && cloudSchedules.length > 0) {
          setSchedules(cloudSchedules);
          storageService.saveSchedules(cloudSchedules);
        } else if (storageService.getSchedules().length > 0) {
          await firebaseSyncService.syncSchedules(uid, storageService.getSchedules());
        }

        if (cloudLogs && cloudLogs.length > 0) {
          setLogs(cloudLogs);
        } else if (storageService.getLogs().length > 0) {
          await firebaseSyncService.syncAllLogs(uid, storageService.getLogs());
        }

        // Subscriptions
        unsubChambers = firebaseSyncService.subscribeChambers(uid, (remoteChambers) => {
          if (remoteChambers && remoteChambers.length > 0) {
            setChambers(remoteChambers);
            storageService.saveChambers(remoteChambers);
          }
        });

        unsubSchedules = firebaseSyncService.subscribeSchedules(uid, (remoteSchedules) => {
          if (remoteSchedules) {
            setSchedules(remoteSchedules);
            storageService.saveSchedules(remoteSchedules);
          }
        });

        unsubLogs = firebaseSyncService.subscribeLogs(uid, (remoteLogs) => {
          if (remoteLogs) {
            setLogs(remoteLogs);
          }
        });
      } catch (e) {
        console.warn('[MedicationContext] Cloud hydration notice:', e);
      } finally {
        setTimeout(() => {
          isHydratingFromCloud.current = false;
        }, 500);
      }
    };

    hydrateAndListen();

    return () => {
      if (unsubChambers) unsubChambers();
      if (unsubSchedules) unsubSchedules();
      if (unsubLogs) unsubLogs();
    };
  }, [user?.id]);

  const syncWithCloudNow = async () => {
    if (!user?.id) return;
    const uid = user.id;
    await Promise.all([
      firebaseSyncService.syncChambers(uid, chambers),
      firebaseSyncService.syncSchedules(uid, schedules),
      firebaseSyncService.syncAllLogs(uid, logs),
    ]);
  };

  const refillChamber = (servoId: number, countToAdd: number) => {
    setChambers((prev) =>
      prev.map((c) => {
        if (c.servoId === servoId) {
          const nextCount = Math.min(c.maxCapacity, c.currentCount + countToAdd);
          return {
            ...c,
            currentCount: nextCount,
            status: nextCount > 5 ? 'ready' : 'low',
          };
        }
        return c;
      })
    );
  };

  const updateChamberConfig = (servoId: number, changes: Partial<ChamberConfig>) => {
    setChambers((prev) =>
      prev.map((c) => (c.servoId === servoId ? { ...c, ...changes } : c))
    );
  };

  const addSchedule = (schedule: Omit<MedicationSchedule, 'id'>) => {
    const newSch: MedicationSchedule = {
      ...schedule,
      id: `sch-${Date.now()}`,
    };
    setSchedules((prev) => [...prev, newSch]);
  };

  const updateSchedule = (id: string, changes: Partial<MedicationSchedule>) => {
    setSchedules((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  };

  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    if (user?.id) {
      firebaseSyncService.deleteScheduleRemote(user.id, id);
    }
  };

  const dispenseNow = async (
    chamberId: 1 | 2 | 3 | 4,
    reason: 'scheduled_auto' | 'app_trigger' | 'hardware_button' | 'manual_override' = 'app_trigger',
    bypassSafety = false,
    count = 1
  ): Promise<{ success: boolean; message: string; safetyEvaluation?: DispenseSafetyEvaluation; response?: string }> => {
    const chamber = chambers.find((c) => c.servoId === chamberId);
    if (!chamber) {
      return { success: false, message: 'Invalid bottle ID requested' };
    }
    const pillCount = Math.max(1, count);
    if (chamber.currentCount < pillCount) {
      return {
        success: false,
        message: `Bottle ${chamberId} (${chamber.medicationName || 'Bottle ' + chamberId}) has only ${chamber.currentCount} pill${chamber.currentCount === 1 ? '' : 's'} remaining! Cannot dispense ${pillCount}.`,
      };
    }

    // Pre-dispense safety check
    if (!bypassSafety) {
      const evaluation = medicationSafetyService.validateDispenseSafety(chamberId, chambers, logs, pillCount);
      if (!evaluation.safeToDispense) {
        return {
          success: false,
          message: evaluation.blockReason || evaluation.warnings[0] || 'Safety limits exceeded',
          safetyEvaluation: evaluation,
        };
      }
    }

    // Call hardware servo
    const result = await triggerDispense(chamber, pillCount);

    if (result.success) {
      // Decrement pill count
      setChambers((prev) =>
        prev.map((c) => {
          if (c.servoId === chamberId) {
            const nextCount = Math.max(0, c.currentCount - pillCount);
            return {
              ...c,
              currentCount: nextCount,
              status: nextCount === 0 ? 'empty' : nextCount <= 4 ? 'low' : 'ready',
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

      setLogs((prev) => [newLog, ...prev]);

      if (user?.id) {
        firebaseSyncService.syncLog(user.id, newLog);
      }
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

    const counts: Record<number, number> = {};
    for (const id of sequence) {
      counts[id] = (counts[id] || 0) + 1;
    }

    for (const [idStr, needed] of Object.entries(counts)) {
      const id = Number(idStr) as 1 | 2 | 3;
      const ch = chambers.find((c) => c.servoId === id);
      if (!ch || ch.currentCount < needed) {
        return {
          success: false,
          message: `Bottle ${id} (${ch?.medicationName || `Bottle ${id}`}) has insufficient pills (${ch?.currentCount || 0} available, ${needed} required).`,
        };
      }
    }

    if (!bypassSafety) {
      for (const [idStr, needed] of Object.entries(counts)) {
        const id = Number(idStr) as 1 | 2 | 3;
        const evaluation = medicationSafetyService.validateDispenseSafety(id, chambers, logs, needed);
        if (!evaluation.safeToDispense) {
          return {
            success: false,
            message: `Safety check failed for Bottle ${id}: ${evaluation.blockReason || evaluation.warnings[0] || 'Limit reached'}`,
          };
        }
      }
    }

    const bottleNames: Record<number, string> = {};
    chambers.forEach((c) => {
      bottleNames[c.servoId] = c.medicationName;
    });

    const result = await triggerChainedDispense(sequence, bottleNames);

    if (result.success) {
      setChambers((prev) =>
        prev.map((c) => {
          const used = counts[c.servoId] || 0;
          if (used > 0) {
            const nextCount = Math.max(0, c.currentCount - used);
            return {
              ...c,
              currentCount: nextCount,
              status: nextCount === 0 ? 'empty' : nextCount <= 4 ? 'low' : 'ready',
            };
          }
          return c;
        })
      );

      const newLogs: DispenseLog[] = [];
      for (const [idStr, used] of Object.entries(counts)) {
        const id = Number(idStr) as 1 | 2 | 3;
        const ch = chambers.find((c) => c.servoId === id);
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
        if (user?.id) {
          firebaseSyncService.syncLog(user.id, logEntry);
        }
      }

      setLogs((prev) => [...newLogs, ...prev]);
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
    setChambers((prev) =>
      prev.map((c) => {
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

    setSchedules((prev) => {
      const existing = prev.find((s) => s.chamberId === data.slotId);
      if (existing) {
        return prev.map((s) =>
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
          pillColor: 'var(--ios-label)',
          activeIngredients: data.activeIngredients,
          maxDailyDoses: data.maxDailyDoses,
        };
        return [...prev, newSch];
      }
    });
  };

  const calculateAdherenceRate = (): number => {
    if (logs.length === 0) return 96;
    const successes = logs.filter((l) => l.status === 'success').length;
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
    const chamber = data.chamberId ? chambers.find((c) => c.servoId === data.chamberId) : undefined;
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

    setLogs((prev) => [newLog, ...prev]);

    if (user?.id) {
      firebaseSyncService.syncLog(user.id, newLog);
    }

    if (data.chamberId && data.chamberId >= 1 && data.chamberId <= 4) {
      setChambers((prev) =>
        prev.map((c) => {
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
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (user?.id) {
      firebaseSyncService.deleteLogRemote(user.id, id);
    }
  };

  const clearLogs = () => {
    storageService.clearLogs();
    setLogs([]);
    if (user?.id) {
      firebaseSyncService.clearAllLogsRemote(user.id);
    }
  };

  const seedSampleLogs = () => {
    const now = Date.now();
    const demoLogs: DispenseLog[] = [
      {
        id: `log-seed-${now}-1`,
        timestamp: new Date(now - 1000 * 60 * 35).toISOString(),
        chamberId: 1,
        medicationName: chambers[0]?.medicationName || 'Lisinopril 10mg',
        status: 'success',
        dispensedBy: 'scheduled_auto',
        notes: 'Morning scheduled dose dispensed',
        pillsDispensed: 1,
      },
      {
        id: `log-seed-${now}-2`,
        timestamp: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
        chamberId: 1,
        medicationName: chambers[0]?.medicationName || 'Lisinopril 10mg',
        status: 'success',
        dispensedBy: 'app_trigger',
        notes: 'Midday dose via in-app button',
        pillsDispensed: 1,
      },
      {
        id: `log-seed-${now}-3`,
        timestamp: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
        chamberId: 1,
        medicationName: chambers[0]?.medicationName || 'Lisinopril 10mg',
        status: 'success',
        dispensedBy: 'scheduled_auto',
        notes: 'Scheduled dose taken on time',
        pillsDispensed: 1,
      },
      {
        id: `log-seed-${now}-4`,
        timestamp: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
        chamberId: 1,
        medicationName: chambers[0]?.medicationName || 'Lisinopril 10mg',
        status: 'success',
        dispensedBy: 'hardware_button',
        notes: 'Physical button pressed on dispenser',
        pillsDispensed: 1,
      },
      {
        id: `log-seed-${now}-5`,
        timestamp: new Date(now - 1000 * 60 * 60 * 52).toISOString(),
        chamberId: 1,
        medicationName: chambers[0]?.medicationName || 'Lisinopril 10mg',
        status: 'success',
        dispensedBy: 'scheduled_auto',
        notes: 'Evening routine completed',
        pillsDispensed: 1,
      },
    ];

    demoLogs.forEach((l) => storageService.addLog(l));
    setLogs(storageService.getLogs());

    if (user?.id) {
      demoLogs.forEach((l) => firebaseSyncService.syncLog(user.id, l));
    }
  };

  const loadDemoPrescription = () => {
    applyPrescriptionScan({
      slotId: 1,
      medicationName: 'Lisinopril',
      pillStrength: '10mg',
      activeIngredients: [{ name: 'Lisinopril', amountMg: 10 }],
      maxDailyDoses: 2,
      dosage: '1 tablet daily',
      times: ['08:00', '20:00'],
      instructions: 'Take with water every morning and evening. Do not double dose.',
      prescribedBy: 'Dr. Sarah Chen, MD (Cardiology)',
    });
    setChambers((prev) =>
      prev.map((c) =>
        c.servoId === 1
          ? {
              ...c,
              medicationName: 'Lisinopril',
              pillStrength: '10mg',
              currentCount: 30,
              maxCapacity: 30,
              status: 'ready',
              activeIngredients: [{ name: 'Lisinopril', amountMg: 10 }],
              maxDailyDoses: 2,
            }
          : c
      )
    );
  };

  const setChamberInventory = (servoId: number, count: number) => {
    const clamped = Math.max(0, count);
    setChambers((prev) =>
      prev.map((c) => {
        if (c.servoId === servoId) {
          return {
            ...c,
            currentCount: clamped,
            status: clamped === 0 ? 'empty' : clamped <= 4 ? 'low' : 'ready',
          };
        }
        return c;
      })
    );
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
        clearLogs,
        seedSampleLogs,
        loadDemoPrescription,
        setChamberInventory,
        syncWithCloudNow,
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
