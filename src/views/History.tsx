import { useMedication } from '../context/MedicationContext';
import { DispenseLog } from '../types';

const SOURCE: Record<DispenseLog['dispensedBy'], string> = {
  scheduled_auto: 'scheduled',
  app_trigger: 'app',
  hardware_button: 'emergency',
};

export function History() {
  const { logs } = useMedication();
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = logs.filter((l) => new Date(l.timestamp).getTime() > weekAgo).length;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heartware-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h2>Last 7 days</h2>
      <p>
        {thisWeek} {thisWeek === 1 ? 'dose' : 'doses'} dispensed
      </p>

      <h2>All</h2>
      {logs.length === 0 ? (
        <p className="mute">Nothing dispensed yet.</p>
      ) : (
        <ul>
          {logs.map((l) => (
            <li key={l.id}>
              <p>{l.medicationName}</p>
              <p className="mute">
                {new Date(l.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · slot {l.chamberId} ·{' '}
                {SOURCE[l.dispensedBy]}
              </p>
            </li>
          ))}
        </ul>
      )}

      {logs.length > 0 && (
        <p style={{ marginTop: 16 }}>
          <button onClick={exportJson}>Export</button>
        </p>
      )}
    </>
  );
}
