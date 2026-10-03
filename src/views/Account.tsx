import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';

export function Account() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [contactName, setContactName] = useState(user?.emergencyContact.name ?? '');
  const [contactPhone, setContactPhone] = useState(user?.emergencyContact.phone ?? '');
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    updateProfile({ name: name.trim(), emergencyContact: { name: contactName.trim(), phone: contactPhone.trim() } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    if (confirm('Reset slots, schedule and history on this device?')) {
      storageService.resetDevice();
      location.reload();
    }
  };

  return (
    <>
      <h2>Signed in</h2>
      <p>{user.email}</p>
      <p className="mute" style={{ textTransform: 'capitalize' }}>{user.role}</p>

      <h2>Profile</h2>
      <form onSubmit={save}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Emergency contact
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" />
        </label>
        <label>
          Contact phone
          <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} autoComplete="tel" />
        </label>
        <p>
          <button type="submit">{saved ? 'Saved' : 'Save'}</button>
        </p>
      </form>

      <h2>Device</h2>
      <p>
        <button className="danger" onClick={reset}>Reset device data</button>
      </p>

      <h2>Session</h2>
      <p>
        <button className="danger" onClick={logout}>Sign out</button>
      </p>
    </>
  );
}
