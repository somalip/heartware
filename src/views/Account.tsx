import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAlert } from '../context/AlertContext';
import { storageService } from '../services/storageService';
import { notificationService } from '../services/notificationService';
import { MedicationSafetyInfoModal } from '../components/MedicationSafetyInfoModal';
import { triggerHaptic } from '../utils/haptics';

export function Account() {
  const { user, updateProfile, logout } = useAuth();
  const { showToast } = useToast();
  const { showConfirm } = useAlert();

  const [name, setName] = useState(user?.name ?? '');
  const [contactName, setContactName] = useState(user?.emergencyContact.name ?? '');
  const [contactPhone, setContactPhone] = useState(user?.emergencyContact.phone ?? '');
  const [notifPerm, setNotifPerm] = useState(notificationService.getPermission());
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const isStandalone = notificationService.isStandalone();

  if (!user) return null;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    updateProfile({
      name: name.trim(),
      emergencyContact: { name: contactName.trim(), phone: contactPhone.trim() },
    });
    showToast('Profile updated', 'success');
  };

  const handleResetDevice = async () => {
    const confirmed = await showConfirm({
      title: 'Reset Dispenser?',
      message: 'Reverts chambers, servo calibration angles, and schedules back to factory calibration presets. Accounts remain intact.',
      confirmText: 'Reset Configuration',
      cancelText: 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      storageService.resetDevice();
      showToast('Device reset to factory defaults', 'warning');
      setTimeout(() => location.reload(), 600);
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: 'Sign Out?',
      message: 'Are you sure you want to sign out of Heartware on this device?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      logout();
    }
  };

  const handleEnableNotifications = async () => {
    triggerHaptic('medium');
    const res = await notificationService.requestPermission();
    setNotifPerm(res);
    if (res === 'granted') {
      showToast('Notifications enabled!', 'success');
      await notificationService.sendTestNotification();
    } else if (res === 'denied') {
      showToast('Notifications blocked in browser/system settings', 'error');
    }
  };

  return (
    <>
      <div className="ios-large-title-block">
        <h1 className="ios-large-title">Settings</h1>
      </div>

      {/* Responsive Settings Grid: 2 Columns on Desktop, Single Column on Mobile */}
      <div className="settings-desktop-grid">
        {/* Profile & Emergency Contact Column */}
        <div>
          <form onSubmit={handleSave}>
            {/* Account Info Inset Group */}
            <div className="ios-section">
              <div className="ios-section-header">Account Information</div>
              <div className="ios-list">
                <div className="ios-row">
                  <div className="ios-detail-label">Full Name</div>
                  <input
                    className="ios-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Required"
                    required
                  />
                </div>
                <div className="ios-row">
                  <div className="ios-detail-label">Email</div>
                  <div className="ios-row-value ios-row-value-inline">
                    {user.email}
                  </div>
                </div>
                <div className="ios-row">
                  <div className="ios-detail-label">Role</div>
                  <div className="ios-row-value ios-row-value-inline" style={{ textTransform: 'capitalize' }}>
                    {user.role}
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Relay Inset Group */}
            <div className="ios-section">
              <div className="ios-section-header">Emergency Contact</div>
              <div className="ios-list">
                <div className="ios-row">
                  <div className="ios-detail-label">Contact Name</div>
                  <input
                    className="ios-input"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="ios-row">
                  <div className="ios-detail-label">Phone Number</div>
                  <input
                    type="tel"
                    className="ios-input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: '0 4px', marginBottom: '24px' }}>
              <button type="submit" className="ios-btn-primary">
                Save Profile
              </button>
            </div>
          </form>
        </div>

        {/* System, Notifications & Device Column */}
        <div>
          {/* Notifications Section */}
          <div className="ios-section">
            <div className="ios-section-header">Notifications</div>
            <div className="ios-list">
              <div className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-title">Dosing Reminders</div>
                  <div className="ios-row-sublabel">
                    {notifPerm === 'granted'
                      ? 'Active · Lock screen & watch alerts enabled'
                      : notifPerm === 'denied'
                      ? 'Blocked · Enable notifications in browser/system settings'
                      : notifPerm === 'unsupported'
                      ? 'Notifications not supported in this browser'
                      : 'Receive scheduled medication alerts'}
                  </div>
                </div>
                {notifPerm === 'granted' ? (
                  <span className="ios-badge green">Active</span>
                ) : notifPerm === 'denied' ? (
                  <span className="ios-badge red">Blocked</span>
                ) : notifPerm === 'unsupported' ? (
                  <span className="ios-badge">Unavailable</span>
                ) : (
                  <button
                    type="button"
                    className="ios-pill-btn blue"
                    onClick={handleEnableNotifications}
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
            <div className="ios-section-footer">
              {isStandalone
                ? 'Active as Home Screen Web App. Dosing alerts appear directly on your Lock Screen and Apple Watch.'
                : 'For notifications on iOS, tap the Share icon and select "Add to Home Screen". Once added, notifications can alert your Lock Screen.'}
            </div>
          </div>

          {/* Safety Database Section */}
          <div className="ios-section">
            <div className="ios-section-header">Clinical Standards & Safety</div>
            <div className="ios-list">
              <div
                className="ios-row interactive"
                onClick={() => {
                  triggerHaptic('light');
                  setShowSafetyModal(true);
                }}
              >
                <div className="ios-row-content">
                  <div className="ios-row-title">Dosage limits</div>
                  <div className="ios-row-sublabel">
                    How daily limits are calculated
                  </div>
                </div>
                <div className="ios-chevron" style={{ color: 'var(--ios-tertiary)', fontSize: '20px' }}>›</div>
              </div>
            </div>
          </div>

          {/* Device Management Section */}
          <div className="ios-section">
            <div className="ios-section-header">Device</div>
            <div className="ios-list">
              <div className="ios-row interactive" onClick={handleResetDevice}>
                <button type="button" className="ios-row-action danger">
                  Reset Configuration
                </button>
              </div>
            </div>
          </div>

          {/* Session Management */}
          <div className="ios-section">
            <div className="ios-list">
              <div className="ios-row interactive" onClick={handleLogout}>
                <button type="button" className="ios-row-action danger center">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSafetyModal && (
        <MedicationSafetyInfoModal onClose={() => setShowSafetyModal(false)} />
      )}
    </>
  );
}
