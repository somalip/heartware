import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === 'in' ? await login(email, password) : await register({ name, email, password, role });
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <main>
      <h1>Heartware</h1>
      <p className="mute">Medication dispenser</p>

      <h2>{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
      <form onSubmit={submit}>
        {mode === 'up' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>
        {mode === 'up' && (
          <label>
            I am a
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="patient">Patient</option>
              <option value="caregiver">Caregiver</option>
              <option value="clinician">Clinician</option>
            </select>
          </label>
        )}
        {error && <p className="danger">{error}</p>}
        <p>
          <button type="submit" disabled={busy}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
        </p>
      </form>

      <h2>{mode === 'in' ? 'New here?' : 'Have an account?'}</h2>
      <p>
        <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }}>
          {mode === 'in' ? 'Create account' : 'Sign in'}
        </button>
      </p>
      <p className="mute">Accounts are stored on this device only.</p>
    </main>
  );
}
