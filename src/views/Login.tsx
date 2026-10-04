import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';
import { IosSpinner } from '../components/IosSpinner';
import { triggerHaptic } from '../utils/haptics';

interface RememberedLogin {
  email: string;
  password?: string;
  remember: boolean;
}

const REMEMBERED_LOGIN_KEY = 'heartware_remembered_login';

const getSavedLogin = (): RememberedLogin | null => {
  try {
    const raw = localStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function Login() {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [savedLogin, setSavedLogin] = useState<RememberedLogin | null>(() => getSavedLogin());
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => savedLogin?.email ?? '');
  const [password, setPassword] = useState(() => savedLogin?.password ?? '');
  const [rememberLogin, setRememberLogin] = useState<boolean>(() => savedLogin?.remember ?? true);
  const [role, setRole] = useState<UserRole>('patient');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleToggleRemember = (checked: boolean) => {
    triggerHaptic('selection');
    setRememberLogin(checked);
    if (!checked) {
      try {
        localStorage.removeItem(REMEMBERED_LOGIN_KEY);
        setSavedLogin(null);
      } catch {
        // Ignore storage exceptions
      }
    }
  };

  const handleClearSaved = () => {
    triggerHaptic('light');
    setEmail('');
    setPassword('');
    setSavedLogin(null);
    try {
      localStorage.removeItem(REMEMBERED_LOGIN_KEY);
    } catch {
      // Ignore
    }
    showToast('Saved login details removed from cache', 'info');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setBusy(true);
    setError(null);
    const err = mode === 'in' ? await login(email, password) : await register({ name, email, password, role });
    setBusy(false);
    if (err) {
      triggerHaptic('warning');
      setError(err);
    } else {
      try {
        if (rememberLogin) {
          const loginData: RememberedLogin = {
            email: email.trim(),
            password,
            remember: true,
          };
          localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify(loginData));
          setSavedLogin(loginData);
        } else {
          localStorage.removeItem(REMEMBERED_LOGIN_KEY);
          setSavedLogin(null);
        }
      } catch {
        // Ignore storage exceptions
      }
      triggerHaptic('success');
      showToast(mode === 'in' ? 'Signed in successfully' : 'Account created', 'success');
    }
  };

  const handleSwitchMode = (nextMode: 'in' | 'up') => {
    triggerHaptic('selection');
    setMode(nextMode);
    setError(null);
  };

  return (
    <div className="login-desktop-wrapper">
      <div className="login-desktop-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--ios-label)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ios-bg)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              <polyline points="3.5 12 8.5 12 10.5 8 13.5 16 15.5 12 20.5 12" />
            </svg>
          </div>
        </div>

        <div className="ios-login-header" style={{ margin: '0 0 24px' }}>
          <h1 className="ios-login-title">
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="ios-login-subtitle">
            {mode === 'in' ? 'Heartware' : 'Stored on this device'}
          </p>
        </div>

      <form onSubmit={handleSubmit}>
        <div className="ios-section">
          <div className="ios-list">
            {mode === 'up' && (
              <div className="ios-row">
                <div className="ios-detail-label">Name</div>
                <input
                  id="login-name"
                  name="name"
                  className="ios-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="ios-row">
              <div className="ios-detail-label">Email</div>
              <input
                id="login-email"
                name="email"
                type="email"
                className="ios-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="username email"
                required
              />
            </div>

            <div className="ios-row">
              <div className="ios-detail-label">Password</div>
              <input
                id="login-password"
                name="password"
                type="password"
                className="ios-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'in' ? 'Password' : 'At least 6 characters'}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </div>

            {mode === 'up' && (
              <div className="ios-row">
                <div className="ios-detail-label">Role</div>
                <select
                  id="login-role"
                  name="role"
                  className="ios-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="patient">Patient</option>
                  <option value="caregiver">Caregiver</option>
                  <option value="clinician">Clinician</option>
                </select>
              </div>
            )}

            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Remember login details</div>
                <div className="ios-row-sublabel">
                  {savedLogin?.email ? `Cached for ${savedLogin.email}` : 'Store credentials in browser cache'}
                </div>
              </div>
              <label className="ios-switch" aria-label="Remember login details">
                <input
                  type="checkbox"
                  checked={rememberLogin}
                  onChange={(e) => handleToggleRemember(e.target.checked)}
                />
                <span className="ios-switch-slider" />
              </label>
            </div>
          </div>

          {savedLogin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px', padding: '0 4px' }}>
              <button
                type="button"
                onClick={handleClearSaved}
                className="ios-nav-action"
                style={{ fontSize: '12px', color: 'var(--ios-red)' }}
              >
                Clear cached login
              </button>
            </div>
          )}

          {error && (
            <div className="ios-form-error">
              {error}
            </div>
          )}
        </div>

        <button type="submit" className="ios-btn-primary" disabled={busy}>
          {busy ? (
            <>
              <IosSpinner size={18} color="#ffffff" />
              <span>{mode === 'in' ? 'Signing In…' : 'Creating Account…'}</span>
            </>
          ) : mode === 'in' ? (
            'Sign In'
          ) : (
            'Create Account'
          )}
        </button>
      </form>

        <div className="ios-login-switch">
          <span>{mode === 'in' ? "Don't have an account?" : 'Already have an account?'}</span>
          <button
            type="button"
            className="ios-nav-action"
            style={{ fontWeight: 600, fontSize: '15px' }}
            onClick={() => handleSwitchMode(mode === 'in' ? 'up' : 'in')}
          >
            {mode === 'in' ? 'Create Account' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
