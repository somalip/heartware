import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HardwareProvider } from './context/HardwareContext';
import { MedicationProvider } from './context/MedicationContext';
import { Login } from './views/Login';
import { Dispenser } from './views/Dispenser';
import { Schedule } from './views/Schedule';
import { History } from './views/History';
import { Care } from './views/Care';
import { Account } from './views/Account';

const TABS = [
  ['dispenser', 'Dispenser'],
  ['schedule', 'Schedule'],
  ['history', 'History'],
  ['care', 'Care'],
  ['account', 'Account'],
] as const;

type Tab = (typeof TABS)[number][0];

function Shell() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dispenser');
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!user) return <Login />;

  return (
    <main>
      <header>
        <h1>Heartware</h1>
        <p className="mute">
          {user.name}
          {offline ? ' · offline' : ''}
        </p>
        <nav>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'dispenser' && <Dispenser />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'history' && <History />}
      {tab === 'care' && <Care goToAccount={() => setTab('account')} />}
      {tab === 'account' && <Account />}
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HardwareProvider>
        <MedicationProvider>
          <Shell />
        </MedicationProvider>
      </HardwareProvider>
    </AuthProvider>
  );
}
