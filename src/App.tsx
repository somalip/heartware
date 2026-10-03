import { ReactNode, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HardwareProvider } from './context/HardwareContext';
import { MedicationProvider } from './context/MedicationContext';
import { Login } from './views/Login';
import { Dispenser } from './views/Dispenser';
import { Schedule } from './views/Schedule';
import { History } from './views/History';
import { Care } from './views/Care';
import { Account } from './views/Account';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ICONS = {
  dispenser: svg(
    <g transform="rotate(-45 12 12)">
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" />
      <path d="M12 8.5v7" />
    </g>
  ),
  schedule: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  history: svg(
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </>
  ),
  care: svg(<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />),
  account: svg(
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c.6-3.7 3.7-5.7 7.5-5.7s6.9 2 7.5 5.7" />
    </>
  ),
};

const TABS = [
  ['dispenser', 'Dispenser'],
  ['schedule', 'Schedule'],
  ['history', 'History'],
  ['care', 'Care'],
  ['account', 'Account'],
] as const;

type Tab = (typeof TABS)[number][0];

/** iOS-style nav bar: transparent over the large title, blurred with a small title once scrolled. */
export function NavBar({ title }: { title: string }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 36);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <>
      <span className="statusbar" aria-hidden="true" />
      <header className={collapsed ? 'navbar collapsed' : 'navbar'}>
        <span>{title}</span>
      </header>
    </>
  );
}

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

  const title = TABS.find(([id]) => id === tab)![1];

  // Like iOS: tapping the active tab scrolls to top; switching tabs starts at the top.
  const select = (id: Tab) => {
    if (id === tab) window.scrollTo({ top: 0, behavior: 'smooth' });
    else {
      setTab(id);
      window.scrollTo(0, 0);
    }
  };

  return (
    <>
      <NavBar title={title} />

      <main>
        <h1>{title}</h1>
        {offline && <p className="mute">Offline</p>}

        {tab === 'dispenser' && <Dispenser />}
        {tab === 'schedule' && <Schedule />}
        {tab === 'history' && <History />}
        {tab === 'care' && <Care goToAccount={() => select('account')} />}
        {tab === 'account' && <Account />}
      </main>

      <nav className="tabbar" aria-label="Tabs">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => select(id)} aria-current={tab === id ? 'page' : undefined}>
            {ICONS[id]}
            {label}
          </button>
        ))}
      </nav>
    </>
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
