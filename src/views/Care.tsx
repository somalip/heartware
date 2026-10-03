import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedication } from '../context/MedicationContext';
import { COMMUNITY_RESOURCES } from '../services/storageService';

const fmtPhone = (p: string) => (p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p);

export function Care({ goToAccount }: { goToAccount: () => void }) {
  const { user } = useAuth();
  const { chambers, dispenseNow } = useMedication();
  const [message, setMessage] = useState<string | null>(null);
  const emergency = chambers.find((c) => c.servoId === 4);
  const contact = user?.emergencyContact;

  const dispenseEmergency = async () => {
    const res = await dispenseNow(4, 'hardware_button');
    setMessage(res.message);
  };

  return (
    <>
      <h2>Emergency</h2>
      <p>
        <a href="tel:911">Call 911</a>
        {contact?.phone && <a href={`tel:${contact.phone}`}>Call {contact.name || 'contact'}</a>}
      </p>
      {!contact?.phone && (
        <p className="mute">
          No emergency contact. <button onClick={goToAccount}>Add one</button>
        </p>
      )}

      <h2>Emergency slot</h2>
      {emergency && (
        <>
          <p>
            {emergency.medicationName} <span className="mute">{emergency.pillStrength} · {emergency.currentCount} left</span>
          </p>
          <p>
            <button onClick={dispenseEmergency} disabled={emergency.currentCount === 0}>
              Dispense now
            </button>
          </p>
        </>
      )}
      {message && <p className="mute" role="status">{message}</p>}

      <h2>Nearby help · sample listings</h2>
      <ul>
        {COMMUNITY_RESOURCES.map((r) => (
          <li key={r.id}>
            <p>{r.title}</p>
            <p className="mute">
              {r.address} · {r.hours}
            </p>
            <p>
              <a href={`tel:${r.phone}`}>{fmtPhone(r.phone)}</a>
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
