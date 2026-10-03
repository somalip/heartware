import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HardwareProvider, useHardware } from './context/HardwareContext';
import { MedicationProvider, useMedication } from './context/MedicationContext';
import { ToastProvider } from './context/ToastContext';
import { AlertProvider } from './context/AlertContext';
import { notificationService } from './services/notificationService';
import { Login } from './views/Login';
import { Dispenser } from './views/Dispenser';
import { Schedule } from './views/Schedule';
import { History } from './views/History';
import { Care } from './views/Care';
import { Account } from './views/Account';
import { triggerHaptic } from './utils/haptics';

const TABS = [
  ['dispenser', 'Dispenser'],
  ['schedule', 'Schedule'],
  ['care', 'Care'],
  ['history', 'History'],
  ['account', 'Settings'],
] as const;

type Tab = (typeof TABS)[number][0];

function TabIcon({ tab, active }: { tab: Tab; active: boolean }) {
  if (tab === 'dispenser') {
    return active ? (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <g transform="rotate(-45 12 12)">
          <rect x="3" y="8" width="18" height="8" rx="4" fill="currentColor" />
          <path d="M12 8v8" stroke="var(--ios-bar-bg)" strokeWidth="1.6" />
        </g>
      </svg>
    ) : (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <g transform="rotate(-45 12 12)">
          <rect x="3" y="8" width="18" height="8" rx="4" />
          <path d="M12 8v8" />
        </g>
      </svg>
    );
  }

  if (tab === 'schedule') {
    return active ? (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="currentColor" />
        <polyline points="12 6.5 12 12 15.5 14" stroke="var(--ios-bar-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 6.5 12 12 15.5 14" />
      </svg>
    );
  }

  if (tab === 'care') {
    return active ? (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="9" y="3" width="6" height="18" rx="2" />
        <rect x="3" y="9" width="18" height="6" rx="2" />
      </svg>
    ) : (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="18" rx="2" />
        <rect x="3" y="9" width="18" height="6" rx="2" />
      </svg>
    );
  }

  if (tab === 'history') {
    return active ? (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 2.64-6.36L2.5 8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="2.5 3.5 2.5 8.5 7.5 8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="5" fill="currentColor" />
        <polyline points="12 9.5 12 12 14 13.5" stroke="var(--ios-bar-bg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 2.64-6.36L2.5 8.5" />
        <polyline points="2.5 3.5 2.5 8.5 7.5 8.5" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    );
  }

  // account / settings
  return active ? (
    <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ) : (
    <svg className="ios-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

function Shell() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dispenser');
  const { schedules, chambers } = useMedication();
  const { state: hwState } = useHardware();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Monitor dosing timetable routines and fire Lock Screen notifications
  useEffect(() => {
    if (!user || schedules.length === 0) return;
    const interval = setInterval(() => {
      notificationService.checkSchedules(schedules, chambers);
    }, 20000);
    notificationService.checkSchedules(schedules, chambers);
    return () => clearInterval(interval);
  }, [user, schedules, chambers]);

  if (!user) return <Login />;

  const currentTabTitle = TABS.find(([id]) => id === tab)![1];

  const handleTabSelect = (newTab: Tab) => {
    if (newTab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      triggerHaptic('selection');
      setTab(newTab);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="app-shell">
      {/* Desktop Sidebar Navigation (Visible >= 840px) */}
      <aside className="desktop-sidebar" aria-label="Desktop Navigation">
        <div className="desktop-sidebar-header">
          <div className="desktop-sidebar-brand">
            <h2 className="desktop-sidebar-title">Heartware Dashboard</h2>
          </div>
        </div>

        {/* Live Hardware Status Pill */}
        <div className="desktop-hardware-badge">
          <span
            className={`desktop-status-dot ${
              hwState.connected
                ? hwState.connectionType === 'ble'
                  ? 'active'
                  : 'simulated'
                : 'offline'
            }`}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hwState.connected
              ? hwState.connectionType === 'ble'
                ? 'ESP32 (BLE Active)'
                : 'Virtual ESP32'
              : 'Disconnected'}
          </span>
          {hwState.connected && (
            <span style={{ marginLeft: 'auto', color: 'var(--ios-secondary)', fontSize: '11px', flexShrink: 0 }}>
              {hwState.batteryLevel}%
            </span>
          )}
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="desktop-sidebar-nav" aria-label="Desktop Primary">
          {TABS.map(([id, label]) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                type="button"
                className={`desktop-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleTabSelect(id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <TabIcon tab={id} active={isActive} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="desktop-user-card">
          <div className="desktop-user-avatar">
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="desktop-user-info">
            <div className="desktop-user-name">{user?.name || user?.email || 'User'}</div>
            <div className="desktop-user-role">{user?.role || 'Patient'} Mode</div>
          </div>
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <div className="app-main-content">
        {/* Notch & Dynamic Island Upper Edge Background Fill (Mobile) */}
        <div className="ios-status-fill" />

        {/* iOS Translucent Collapsing Navigation Bar (Mobile) */}
        <header className={`ios-nav-header ${isScrolled ? 'scrolled' : ''}`}>
          <div className="ios-nav-content">
            <div className="ios-nav-title">{currentTabTitle}</div>
          </div>
        </header>

        {/* Main Screen Container with iOS Safe-Area Padding */}
        <main className="ios-screen" key={tab}>
          {tab === 'dispenser' && <Dispenser />}
          {tab === 'schedule' && <Schedule />}
          {tab === 'care' && <Care goToAccount={() => handleTabSelect('account')} />}
          {tab === 'history' && <History />}
          {tab === 'account' && <Account />}
        </main>

        {/* iOS Frosted Bottom Tab Bar (Mobile) */}
        <nav className="ios-tab-bar" aria-label="Main Navigation">
          {TABS.map(([id, label]) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                className={`ios-tab-item ${isActive ? 'active' : ''}`}
                onClick={() => handleTabSelect(id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <TabIcon tab={id} active={isActive} />
                <span className="ios-tab-label">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HardwareProvider>
        <MedicationProvider>
          <ToastProvider>
            <AlertProvider>
              <Shell />
            </AlertProvider>
          </ToastProvider>
        </MedicationProvider>
      </HardwareProvider>
    </AuthProvider>
  );
}
