import { ChamberConfig, MedicationSchedule, DispenseLog, CommunityResource } from '../types';

// Device data (slots, schedules, history). Accounts live in AuthContext.
const KEYS = {
  CHAMBERS: 'heartware_chambers',
  SCHEDULES: 'heartware_schedules',
  LOGS: 'heartware_logs',
};

const emptySlot = (servoId: 1 | 2 | 3 | 4): ChamberConfig => ({
  servoId,
  medicationName: '',
  pillStrength: '',
  currentCount: 0,
  maxCapacity: 30,
  servoAngleRest: 0,
  servoAngleDispense: 90,
  colorTag: '#111',
  status: 'ready',
  slotLabel: `Slot ${servoId}`,
});

export const INITIAL_CHAMBERS: ChamberConfig[] = [
  emptySlot(1),
  emptySlot(2),
  emptySlot(3),
  emptySlot(4),
];

export const INITIAL_SCHEDULES: MedicationSchedule[] = [];

export const COMMUNITY_RESOURCES: CommunityResource[] = [];

// Cleanse legacy dummy/mock data (e.g. Lisinopril, Metformin) from browser storage
function sanitizeInitialStorage() {
  try {
    const rawChambers = localStorage.getItem(KEYS.CHAMBERS);
    if (rawChambers && (rawChambers.includes('Lisinopril') || rawChambers.includes('Metformin'))) {
      localStorage.removeItem(KEYS.CHAMBERS);
    }
    const rawSchedules = localStorage.getItem(KEYS.SCHEDULES);
    if (rawSchedules && (rawSchedules.includes('Lisinopril') || rawSchedules.includes('Metformin'))) {
      localStorage.removeItem(KEYS.SCHEDULES);
    }
  } catch {
    // Ignore storage restrictions
  }
}
sanitizeInitialStorage();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const storageService = {
  getChambers: () => read(KEYS.CHAMBERS, INITIAL_CHAMBERS),
  saveChambers: (v: ChamberConfig[]) => localStorage.setItem(KEYS.CHAMBERS, JSON.stringify(v)),
  getSchedules: () => read(KEYS.SCHEDULES, INITIAL_SCHEDULES),
  saveSchedules: (v: MedicationSchedule[]) => localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(v)),
  getLogs: () => read<DispenseLog[]>(KEYS.LOGS, []),
  addLog(log: Omit<DispenseLog, 'id'>): DispenseLog {
    const entry: DispenseLog = { ...log, id: `log-${Date.now()}` };
    localStorage.setItem(KEYS.LOGS, JSON.stringify([entry, ...this.getLogs()]));
    return entry;
  },
  /** Clears device data only; accounts are kept. */
  resetDevice() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
