import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import { ChamberConfig, MedicationSchedule, DispenseLog, UserProfile } from '../types/index.ts';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

class FirebaseSyncService {
  private statusListeners = new Set<(status: SyncStatus, detail?: string) => void>();
  private currentStatus: SyncStatus = 'idle';
  private lastDetail?: string;

  public getStatus(): { status: SyncStatus; detail?: string } {
    return { status: this.currentStatus, detail: this.lastDetail };
  }

  public subscribeStatus(cb: (status: SyncStatus, detail?: string) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.currentStatus, this.lastDetail);
    return () => this.statusListeners.delete(cb);
  }

  private setStatus(status: SyncStatus, detail?: string) {
    this.currentStatus = status;
    this.lastDetail = detail;
    this.statusListeners.forEach((cb) => cb(status, detail));
  }

  private isDbAvailable(): boolean {
    return Boolean(db);
  }

  // --- Profile Sync ---
  async syncUserProfile(uid: string, profile: UserProfile): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      this.setStatus('syncing', 'Syncing profile to cloud...');
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        id: profile.id || uid,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        emergencyContact: profile.emergencyContact || { name: '', phone: '' },
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      this.setStatus('synced', 'Profile saved');
      return true;
    } catch (e: any) {
      console.warn('[FirebaseSync] syncUserProfile failed:', e);
      this.setStatus('error', e.message);
      return false;
    }
  }

  async fetchUserProfile(uid: string): Promise<UserProfile | null> {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          id: data.id || uid,
          name: data.name || '',
          email: data.email || '',
          role: data.role || 'patient',
          emergencyContact: data.emergencyContact || { name: '', phone: '' },
        };
      }
      return null;
    } catch (e) {
      console.warn('[FirebaseSync] fetchUserProfile failed:', e);
      return null;
    }
  }

  // --- Chambers Sync ---
  async syncChambers(uid: string, chambers: ChamberConfig[]): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      this.setStatus('syncing', 'Syncing dispenser chambers...');
      const ref = doc(db, 'users', uid, 'settings', 'dispenser');
      await setDoc(ref, {
        chambers,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      this.setStatus('synced', 'Dispenser synchronized');
      return true;
    } catch (e: any) {
      console.warn('[FirebaseSync] syncChambers failed:', e);
      this.setStatus('error', e.message);
      return false;
    }
  }

  async fetchChambers(uid: string): Promise<ChamberConfig[] | null> {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const ref = doc(db, 'users', uid, 'settings', 'dispenser');
      const snap = await getDoc(ref);
      if (snap.exists() && Array.isArray(snap.data()?.chambers)) {
        return snap.data().chambers as ChamberConfig[];
      }
      return null;
    } catch (e) {
      console.warn('[FirebaseSync] fetchChambers failed:', e);
      return null;
    }
  }

  subscribeChambers(uid: string, onUpdate: (chambers: ChamberConfig[]) => void): Unsubscribe | null {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const ref = doc(db, 'users', uid, 'settings', 'dispenser');
      return onSnapshot(ref, (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.chambers)) {
          onUpdate(snap.data().chambers as ChamberConfig[]);
          this.setStatus('synced', 'Chambers live synced');
        }
      }, (err) => {
        console.warn('[FirebaseSync] subscribeChambers error:', err);
        this.setStatus('error', err.message);
      });
    } catch (e) {
      console.warn('[FirebaseSync] subscribeChambers exception:', e);
      return null;
    }
  }

  // --- Schedules Sync ---
  async syncSchedules(uid: string, schedules: MedicationSchedule[]): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      this.setStatus('syncing', 'Syncing schedules...');
      const batch = writeBatch(db);
      // We store all schedules in collection users/{uid}/schedules
      // Also store full snapshot in settings/schedules for fast single read
      const metaRef = doc(db, 'users', uid, 'settings', 'schedules');
      batch.set(metaRef, {
        list: schedules,
        updatedAt: new Date().toISOString(),
      });

      // Individual schedule documents for granular queries
      for (const s of schedules) {
        const itemRef = doc(db, 'users', uid, 'schedules', s.id);
        batch.set(itemRef, s);
      }

      await batch.commit();
      this.setStatus('synced', 'Schedules synced');
      return true;
    } catch (e: any) {
      console.warn('[FirebaseSync] syncSchedules failed:', e);
      this.setStatus('error', e.message);
      return false;
    }
  }

  async deleteScheduleRemote(uid: string, scheduleId: string): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      const itemRef = doc(db, 'users', uid, 'schedules', scheduleId);
      await deleteDoc(itemRef);
      return true;
    } catch (e) {
      console.warn('[FirebaseSync] deleteScheduleRemote failed:', e);
      return false;
    }
  }

  async fetchSchedules(uid: string): Promise<MedicationSchedule[] | null> {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const metaRef = doc(db, 'users', uid, 'settings', 'schedules');
      const snap = await getDoc(metaRef);
      if (snap.exists() && Array.isArray(snap.data()?.list)) {
        return snap.data().list as MedicationSchedule[];
      }

      // Fallback: list from collection
      const collRef = collection(db, 'users', uid, 'schedules');
      const colSnap = await getDocs(collRef);
      if (!colSnap.empty) {
        return colSnap.docs.map((d) => d.data() as MedicationSchedule);
      }
      return null;
    } catch (e) {
      console.warn('[FirebaseSync] fetchSchedules failed:', e);
      return null;
    }
  }

  subscribeSchedules(uid: string, onUpdate: (schedules: MedicationSchedule[]) => void): Unsubscribe | null {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const metaRef = doc(db, 'users', uid, 'settings', 'schedules');
      return onSnapshot(metaRef, (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
          onUpdate(snap.data().list as MedicationSchedule[]);
          this.setStatus('synced', 'Schedules live synced');
        }
      }, (err) => {
        console.warn('[FirebaseSync] subscribeSchedules error:', err);
      });
    } catch (e) {
      console.warn('[FirebaseSync] subscribeSchedules exception:', e);
      return null;
    }
  }

  // --- Dispense Logs Sync ---
  async syncLog(uid: string, log: DispenseLog): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      const ref = doc(db, 'users', uid, 'logs', log.id);
      await setDoc(ref, log);
      return true;
    } catch (e: any) {
      console.warn('[FirebaseSync] syncLog failed:', e);
      return false;
    }
  }

  async syncAllLogs(uid: string, logs: DispenseLog[]): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      this.setStatus('syncing', 'Syncing dispense logs...');
      const batch = writeBatch(db);
      // Store compact snapshot document for quick single round-trip hydration
      const metaRef = doc(db, 'users', uid, 'settings', 'logs_snapshot');
      batch.set(metaRef, {
        count: logs.length,
        updatedAt: new Date().toISOString(),
      });

      // Write logs in batches (Firestore supports up to 500 per batch)
      const toSync = logs.slice(0, 400);
      for (const log of toSync) {
        const ref = doc(db, 'users', uid, 'logs', log.id);
        batch.set(ref, log);
      }
      await batch.commit();
      this.setStatus('synced', 'Logs synchronized');
      return true;
    } catch (e: any) {
      console.warn('[FirebaseSync] syncAllLogs failed:', e);
      this.setStatus('error', e.message);
      return false;
    }
  }

  async deleteLogRemote(uid: string, logId: string): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      const ref = doc(db, 'users', uid, 'logs', logId);
      await deleteDoc(ref);
      return true;
    } catch (e) {
      console.warn('[FirebaseSync] deleteLogRemote failed:', e);
      return false;
    }
  }

  async clearAllLogsRemote(uid: string): Promise<boolean> {
    if (!this.isDbAvailable() || !db) return false;
    try {
      const collRef = collection(db, 'users', uid, 'logs');
      const snaps = await getDocs(collRef);
      const batch = writeBatch(db);
      snaps.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return true;
    } catch (e) {
      console.warn('[FirebaseSync] clearAllLogsRemote failed:', e);
      return false;
    }
  }

  async fetchLogs(uid: string): Promise<DispenseLog[] | null> {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const collRef = collection(db, 'users', uid, 'logs');
      const snaps = await getDocs(collRef);
      if (!snaps.empty) {
        const list = snaps.docs.map((d) => d.data() as DispenseLog);
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return list;
      }
      return null;
    } catch (e) {
      console.warn('[FirebaseSync] fetchLogs failed:', e);
      return null;
    }
  }

  subscribeLogs(uid: string, onUpdate: (logs: DispenseLog[]) => void): Unsubscribe | null {
    if (!this.isDbAvailable() || !db) return null;
    try {
      const collRef = collection(db, 'users', uid, 'logs');
      return onSnapshot(collRef, (snaps) => {
        const list = snaps.docs.map((d) => d.data() as DispenseLog);
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        onUpdate(list);
      }, (err) => {
        console.warn('[FirebaseSync] subscribeLogs error:', err);
      });
    } catch (e) {
      console.warn('[FirebaseSync] subscribeLogs exception:', e);
      return null;
    }
  }
}

export const firebaseSyncService = new FirebaseSyncService();
