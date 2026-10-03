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
}

export interface DispenseLog {
  id: string;
  timestamp: string;
  chamberId: 1 | 2 | 3 | 4;
  medicationName: string;
  status: 'success' | 'missed' | 'manual_override' | 'jammed';
  dispensedBy: 'scheduled_auto' | 'app_trigger' | 'hardware_button';
  notes?: string;
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
}

export interface CommunityResource {
  id: string;
  type: 'free_clinic' | 'pharmacy_refill' | 'crisis_pantry';
  title: string;
  address: string;
  hours: string;
  phone: string;
}
