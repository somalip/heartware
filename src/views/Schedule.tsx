import { FormEvent, useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { ChamberConfig } from '../types';

type SlotId = ChamberConfig['servoId'];

export function Schedule() {
  const { schedules, chambers, addSchedule, deleteSchedule } = useMedication();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ chamberId: 1 as SlotId, time: '08:00', asNeeded: false, dosage: '1 tablet', instructions: '' });

  const nameFor = (id: SlotId, fallback: string) => chambers.find((c) => c.servoId === id)?.medicationName ?? fallback;

  const sorted = [...schedules].sort((a, b) => (a.times[0] ?? '').localeCompare(b.times[0] ?? ''));

  const save = (e: FormEvent) => {
    e.preventDefault();
    addSchedule({
      medicationName: nameFor(form.chamberId, ''),
      dosage: form.dosage,
      chamberId: form.chamberId,
      times: [form.asNeeded ? 'As needed' : form.time],
      instructions: form.instructions,
      prescribedBy: '',
      active: true,
      shape: 'round',
      pillColor: '#111',
    });
    setAdding(false);
  };

  return (
    <>
      <h2>Doses</h2>
      {sorted.length === 0 && <p className="mute">No doses scheduled.</p>}
      <ul>
        {sorted.map((s) => (
          <li key={s.id}>
            <p>
              {s.times.join(', ')} · {nameFor(s.chamberId, s.medicationName)}
            </p>
            <p className="mute">
              {s.dosage} · slot {s.chamberId}
              {s.instructions ? ` · ${s.instructions}` : ''}
            </p>
            <p>
              <button onClick={() => deleteSchedule(s.id)}>Remove</button>
            </p>
          </li>
        ))}
      </ul>

      <h2>Add</h2>
      {!adding ? (
        <p>
          <button onClick={() => setAdding(true)}>Add dose</button>
        </p>
      ) : (
        <form onSubmit={save}>
          <label>
            Slot
            <select value={form.chamberId} onChange={(e) => setForm({ ...form, chamberId: Number(e.target.value) as SlotId })}>
              {chambers.map((c) => (
                <option key={c.servoId} value={c.servoId}>
                  {c.servoId}. {c.medicationName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time
            <input
              type="time"
              value={form.time}
              disabled={form.asNeeded}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              required={!form.asNeeded}
            />
          </label>
          <p>
            <button type="button" onClick={() => setForm({ ...form, asNeeded: !form.asNeeded })}>
              {form.asNeeded ? 'Use a set time' : 'As needed instead'}
            </button>
          </p>
          <label style={{ marginTop: 14 }}>
            Dosage
            <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} required />
          </label>
          <label>
            Instructions
            <input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Optional" />
          </label>
          <p>
            <button type="submit">Save</button>
            <button type="button" onClick={() => setAdding(false)}>Cancel</button>
          </p>
        </form>
      )}
    </>
  );
}
