import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserRole } from '../types';
import { IosSpinner } from '../components/IosSpinner';
import { triggerHaptic } from '../utils/haptics';

export function Login() {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="ios-screen" style={{ paddingTop: 'calc(var(--safe-top) + 36px)' }}>
      <div className="ios-login-header">
        <h1 className="ios-login-title">
          {mode === 'in' ? 'Sign In' : 'Create Account'}
        </h1>
        <p className="ios-login-subtitle">
          {mode === 'in'
            ? 'Sign in to access your medication dispenser'
            : 'Register a new account on this device'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="ios-section">
          <div className="ios-list">
            {mode === 'up' && (
              <div className="ios-row">
                <div className="ios-detail-label">Name</div>
                <input
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
                type="email"
                className="ios-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="ios-row">
              <div className="ios-detail-label">Password</div>
              <input
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
          </div>

          {error && (
            <div className="ios-form-error">
              {error}
            </div>
          )}

          <div className="ios-section-footer">
            {mode === 'in'
              ? 'Local biometric/hashed session. Data persists safely on this device.'
              : 'Accounts and dosage routines are stored securely on this device.'}
          </div>
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
  );
}
