import { MedicationSchedule, ChamberConfig } from '../types';

let lastNotifiedMinute = '';

export const notificationService = {
  /**
   * Check if the Notifications API is available in this browser.
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  },

  /**
   * Check if the app is currently running in standalone PWA mode (added to Home Screen on iOS / Android).
   */
  isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
    return Boolean(isIosStandalone || isDisplayStandalone);
  },

  /**
   * Get current notification permission ('granted', 'denied', 'default', or 'unsupported').
   */
  getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  },

  /**
   * Request permission from the user to send notifications.
   * MUST be called directly from a user action (e.g. tap/click) on iOS.
   */
  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';

    try {
      const permission = await Notification.requestPermission();

      // Ensure service worker is registered and ready for notifications
      if (permission === 'granted' && 'serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
        } catch {
          // SW registration fallback
        }
      }

      return permission;
    } catch {
      return 'denied';
    }
  },

  /**
   * Display a local or service worker notification.
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    if (this.getPermission() !== 'granted') return false;

    const notificationOptions: NotificationOptions = {
      icon: '/logo.png',
      badge: '/favicon.png',
      tag: 'heartware-dose',
      ...options,
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, notificationOptions);
          return true;
        }
      }

      // Fallback for desktop/non-SW environments
      new Notification(title, notificationOptions);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Send a test notification to verify delivery on Lock Screen / Home Screen.
   */
  async sendTestNotification(): Promise<boolean> {
    return this.showNotification('Heartware Dosing Alert', {
      body: 'Notifications are active! You will receive alerts when it is time to take your medication.',
      tag: 'heartware-test',
    });
  },

  /**
   * Check schedules against current time (HH:MM) and send notification if due.
   */
  async checkSchedules(schedules: MedicationSchedule[], chambers: ChamberConfig[]): Promise<void> {
    if (this.getPermission() !== 'granted' || schedules.length === 0) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentMinuteKey = `${now.toDateString()} ${hours}:${minutes}`;

    // Prevent duplicate alerts in the same minute
    if (lastNotifiedMinute === currentMinuteKey) return;

    const currentTimeString = `${hours}:${minutes}`;
    const dueSchedules = schedules.filter((s) => s.times.includes(currentTimeString));

    if (dueSchedules.length > 0) {
      lastNotifiedMinute = currentMinuteKey;

      for (const schedule of dueSchedules) {
        const chamber = chambers.find((c) => c.servoId === schedule.chamberId);
        const medName = chamber?.medicationName || schedule.medicationName || `Slot ${schedule.chamberId}`;
        const pillCount = chamber ? ` (${chamber.currentCount} left in slot)` : '';

        await this.showNotification(`Time for ${medName}`, {
          body: `Slot ${schedule.chamberId}: Take ${schedule.dosage}${pillCount}${schedule.instructions ? ` · ${schedule.instructions}` : ''}`,
          tag: `heartware-dose-${schedule.id}`,
        });
      }
    }
  },
};
