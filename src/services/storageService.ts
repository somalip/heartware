import { ChamberConfig, MedicationSchedule, DispenseLog, CommunityResource } from '../types';

// Device data (slots, schedules, history). Accounts live in AuthContext.
const KEYS = {
  CHAMBERS: 'heartware_chambers',
  SCHEDULES: 'heartware_schedules',
  LOGS: 'heartware_logs',
};

const emptyBottle = (servoId: 1 | 2 | 3 | 4 = 1): ChamberConfig => ({
  servoId,
  medicationName: '',
  pillStrength: '',
  currentCount: 0,
  maxCapacity: 30,
  servoAngleRest: 0,
  servoAngleDispense: 90,
  colorTag: '#111',
  status: 'ready',
  slotLabel: `Bottle ${servoId}`,
});

export const INITIAL_CHAMBERS: ChamberConfig[] = [
  emptyBottle(1),
];

export const INITIAL_SCHEDULES: MedicationSchedule[] = [];

export const COMMUNITY_RESOURCES: CommunityResource[] = [];

// Cleanse legacy dummy/mock data from browser storage so app starts fresh
function sanitizeInitialStorage() {
  try {
    const rawChambers = localStorage.getItem(KEYS.CHAMBERS);
    if (rawChambers && (rawChambers.includes('Lisinopril') || rawChambers.includes('Metformin') || rawChambers.includes('DayQuil') || rawChambers.includes('Tylenol'))) {
      localStorage.removeItem(KEYS.CHAMBERS);
      localStorage.removeItem(KEYS.SCHEDULES);
      localStorage.removeItem(KEYS.LOGS);
    }
    const rawSchedules = localStorage.getItem(KEYS.SCHEDULES);
    if (rawSchedules && (rawSchedules.includes('Lisinopril') || rawSchedules.includes('Metformin') || rawSchedules.includes('DayQuil') || rawSchedules.includes('Tylenol'))) {
      localStorage.removeItem(KEYS.SCHEDULES);
      localStorage.removeItem(KEYS.LOGS);
    }
    // If chambers are unassigned or empty, clear any orphan logs
    const chambers = rawChambers ? JSON.parse(rawChambers) : null;
    if (Array.isArray(chambers) && chambers.every((c: any) => !c.medicationName || !c.medicationName.trim())) {
      localStorage.removeItem(KEYS.LOGS);
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
  getChambers: () => {
    const raw = read<ChamberConfig[]>(KEYS.CHAMBERS, INITIAL_CHAMBERS);
    const valid = raw
      .filter((c) => c.servoId === 1)
      .map((c) => ({
        ...c,
        slotLabel: c.slotLabel?.startsWith('Slot') ? `Bottle ${c.servoId}` : c.slotLabel || `Bottle ${c.servoId}`,
      }));
    if (valid.length === 1) return valid;
    return INITIAL_CHAMBERS;
  },
  saveChambers: (v: ChamberConfig[]) => localStorage.setItem(KEYS.CHAMBERS, JSON.stringify(v)),
  getSchedules: () => read(KEYS.SCHEDULES, INITIAL_SCHEDULES),
  saveSchedules: (v: MedicationSchedule[]) => localStorage.setItem(KEYS.SCHEDULES, JSON.stringify(v)),
  getLogs: () => read<DispenseLog[]>(KEYS.LOGS, []),
  addLog(log: Omit<DispenseLog, 'id'>): DispenseLog {
    const entry: DispenseLog = { ...log, id: `log-${Date.now()}` };
    localStorage.setItem(KEYS.LOGS, JSON.stringify([entry, ...this.getLogs()]));
    return entry;
  },
  deleteLog(id: string): void {
    const filtered = this.getLogs().filter((l) => l.id !== id);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(filtered));
  },
  /** Clears device data only; accounts are kept. */
  resetDevice() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
