import { ChamberConfig, MedicationSchedule, DispenseLog, CommunityResource } from '../types';

// Device data (slots, schedules, history). Accounts live in AuthContext.
const KEYS = {
  CHAMBERS: 'heartware_chambers',
  SCHEDULES: 'heartware_schedules',
  LOGS: 'heartware_logs',
};

const slot = (
  servoId: 1 | 2 | 3 | 4,
  medicationName: string,
  pillStrength: string,
  currentCount: number,
  maxCapacity: number
): ChamberConfig => ({
  servoId,
  medicationName,
  pillStrength,
  currentCount,
  maxCapacity,
  servoAngleRest: 0,
  servoAngleDispense: 90,
  colorTag: '#111',
  status: 'ready',
  slotLabel: `Slot ${servoId}`,
});

// Example starting configuration so the app isn't empty on first run.
export const INITIAL_CHAMBERS: ChamberConfig[] = [
  slot(1, 'Lisinopril', '10mg', 14, 28),
  slot(2, 'Metformin', '500mg', 8, 30),
  slot(3, 'Atorvastatin', '20mg', 22, 30),
  slot(4, 'Aspirin', '81mg', 10, 15),
];

const sched = (
  id: string,
  chamberId: 1 | 2 | 3 | 4,
  medicationName: string,
  dosage: string,
  times: string[],
  instructions: string
): MedicationSchedule => ({
  id,
  chamberId,
  medicationName,
  dosage,
  times,
  instructions,
  prescribedBy: '',
  active: true,
  shape: 'round',
  pillColor: '#111',
});

export const INITIAL_SCHEDULES: MedicationSchedule[] = [
  sched('sch-1', 1, 'Lisinopril', '1 tablet', ['08:00'], 'With water'),
  sched('sch-2', 2, 'Metformin', '1 tablet', ['13:00', '19:30'], 'With a meal'),
  sched('sch-3', 3, 'Atorvastatin', '1 tablet', ['21:00'], 'Before bed'),
  sched('sch-4', 4, 'Aspirin', '1 tablet', ['As needed'], 'Emergency use'),
];

// Placeholder listings — replace with a real directory/API before shipping.
export const COMMUNITY_RESOURCES: CommunityResource[] = [
  { id: 'res-1', type: 'free_clinic', title: 'Community Health Clinic', address: '422 Elmwood Ave', hours: 'Mon–Fri 9–6', phone: '5558904100' },
  { id: 'res-2', type: 'pharmacy_refill', title: 'Co-op Pharmacy', address: '810 Heritage Plaza', hours: 'Open 24h', phone: '5552348899' },
  { id: 'res-3', type: 'crisis_pantry', title: 'Prescription Aid Bank', address: '150 Unity Way', hours: 'Mon–Sat 9–5', phone: '5554410192' },
];

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
