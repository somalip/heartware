export type UserRole = 'patient' | 'caregiver' | 'clinician';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
}

export interface ActiveIngredient {
  name: string; // e.g. "Acetaminophen", "Ibuprofen"
  amountMg: number; // e.g. 325, 500
}

export interface MedicationReference {
  id: string;
  brandName: string;
  genericName: string;
  aliases?: string[];
  barcodes?: string[];
  category: 'analgesic' | 'nsaid' | 'cold_flu' | 'allergy' | 'antibiotic' | 'cardiovascular' | 'diabetes' | 'other';
  defaultStrength: string;
  unit: 'tablet' | 'capsule' | 'caplet' | 'liquicap' | 'ml';
  activeIngredients: ActiveIngredient[];
  maxDailyUnits: number;
  minDoseIntervalHours: number;
  warnings: string[];
  description: string;
}

export interface ChamberConfig {
  servoId: 1 | 2 | 3 | 4;
  medicationName: string;
  pillStrength: string;
  currentCount: number;
  maxCapacity: number;
  servoAngleRest: number;
  servoAngleDispense: number;
  colorTag: string;
  status: 'ready' | 'low' | 'empty' | 'jammed' | 'dispensing';
  slotLabel: string;
  medicationId?: string;
  activeIngredients?: ActiveIngredient[];
  maxDailyDoses?: number; // Automatic daily pill limit
  warningNote?: string;
}

export interface MedicationSchedule {
  id: string;
  medicationName: string;
  dosage: string;
  chamberId: 1 | 2 | 3 | 4;
  times: string[]; // "HH:MM" or "As needed"
  instructions: string;
  prescribedBy: string;
  active: boolean;
  shape: 'round' | 'capsule' | 'oval';
  pillColor: string;
  activeIngredients?: ActiveIngredient[];
  maxDailyDoses?: number;
}

export interface DispenseLog {
  id: string;
  timestamp: string;
  chamberId: 1 | 2 | 3 | 4;
  medicationName: string;
  status: 'success' | 'missed' | 'manual_override' | 'jammed';
  dispensedBy: 'scheduled_auto' | 'app_trigger' | 'hardware_button' | 'manual_override';
  notes?: string;
  activeIngredients?: ActiveIngredient[];
  pillsDispensed?: number;
}

export interface CrossIntakeConflict {
  ingredientName: string;
  chambersInvolved: {
    servoId: 1 | 2 | 3 | 4;
    medicationName: string;
    amountMg: number;
  }[];
  severity: 'high' | 'medium';
  message: string;
  safeLimitMg: number;
}

export interface IngredientIntakeProgress {
  ingredientName: string;
  takenTodayMg: number;
  maxDailyMg: number;
  percent: number;
  status: 'safe' | 'warning' | 'exceeded';
  slotsContributing: {
    servoId: 1 | 2 | 3 | 4;
    medicationName: string;
    amountMg: number;
    doseCount: number;
  }[];
}

export interface DispenseSafetyEvaluation {
  safeToDispense: boolean;
  hardBlocked: boolean;
  warnings: string[];
  blockReason?: string;
  exceededIngredient?: {
    name: string;
    currentMg: number;
    wouldBeMg: number;
    maxMg: number;
  };
  recentDoseIntervalViolation?: {
    ingredientName: string;
    lastTakenMinutesAgo: number;
    minIntervalHours: number;
    medicationName: string;
  };
}

export interface BleLogEntry {
  id: string;
  time: string;
  direction: 'rx' | 'tx' | 'info' | 'error';
  message: string;
}

export interface HardwareState {
  connected: boolean;
  connectionType: 'ble' | 'wifi' | 'simulated';
  deviceId: string;
  batteryLevel: number;
  signalRssi: number;
  lastHeartbeat: string;
  isDispensing: boolean;
  activeServo: number | null;
  oledText: { line1: string; line2: string; line3: string; line4: string };
  buzzerEnabled: boolean;
  ledRingColor: string;
  serviceUuid: string;
  characteristicUuid: string;
  lastReadValue?: string;
  lastReadTimestamp?: string;
  isReading?: boolean;
  isWriting?: boolean;
  bleLogs: BleLogEntry[];
  bluetoothSupported: boolean;
}

export interface CommunityResource {
  id: string;
  type: 'free_clinic' | 'pharmacy_refill' | 'crisis_pantry';
  title: string;
  address: string;
  hours: string;
  phone: string;
}
