import { FormEvent, useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useHardware } from '../context/HardwareContext';
import { ChamberConfig } from '../types';

function nextDose(schedules: ReturnType<typeof useMedication>['schedules'], chambers: ChamberConfig[]) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const doses = schedules
    .filter((s) => s.active)
    .flatMap((s) =>
      s.times
        .filter((t) => /^\d{2}:\d{2}$/.test(t))
        .map((t) => {
          const [h, m] = t.split(':').map(Number);
          const name = chambers.find((c) => c.servoId === s.chamberId)?.medicationName ?? s.medicationName;
          return { min: h * 60 + m, time: t, name };
        })
    )
    .sort((a, b) => a.min - b.min);
  if (!doses.length) return null;
  const upcoming = doses.find((d) => d.min > nowMin);
  return upcoming ? `${upcoming.time} · ${upcoming.name}` : `Tomorrow ${doses[0].time} · ${doses[0].name}`;
}

export function Dispenser() {
  const { chambers, schedules, dispenseNow, refillChamber } = useMedication();
  const { state, connectBluetooth, disconnect } = useHardware();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const dispense = async (id: ChamberConfig['servoId']) => {
    setMessage(null);
    const res = await dispenseNow(id, 'app_trigger');
    setMessage(res.message);
  };

  const connect = async () => {
    const res = await connectBluetooth();
    setMessage(res.message);
  };

  const next = nextDose(schedules, chambers);
  const o = state.oledText;

  return (
    <>
      <h2>Next dose</h2>
      <p>{next ?? 'Nothing scheduled'}</p>

      <h2>Device</h2>
      <p>
        {state.connected
          ? `${state.deviceId} · ${state.connectionType === 'ble' ? 'Bluetooth' : 'Simulated'}`
          : 'Not connected'}
      </p>
      <p>
        {state.connected ? (
          <button onClick={disconnect}>Disconnect</button>
        ) : (
          <button onClick={connect}>Connect</button>
        )}
      </p>

      <h2>Display</h2>
      <pre>{[o.line1, o.line2, o.line3, o.line4].join('\n')}</pre>

      <h2>Slots</h2>
      <ul>
        {chambers.map((c) => {
          const low = c.currentCount > 0 && c.currentCount <= 4;
          return (
            <li key={c.servoId}>
              <p>
                {c.servoId}. {c.medicationName} <span className="mute">{c.pillStrength}</span>
              </p>
              <p className={c.currentCount === 0 || low ? 'danger' : 'mute'}>
                {c.currentCount === 0 ? 'Empty' : `${c.currentCount} of ${c.maxCapacity} left${low ? ' · low' : ''}`}
              </p>
              {editing === c.servoId ? (
                <SlotForm chamber={c} onDone={() => setEditing(null)} />
              ) : (
                <p>
                  <button onClick={() => dispense(c.servoId)} disabled={state.isDispensing || c.currentCount === 0}>
                    {state.activeServo === c.servoId ? 'Dispensing…' : 'Dispense'}
                  </button>
                  <button onClick={() => refillChamber(c.servoId, c.maxCapacity)} disabled={c.currentCount === c.maxCapacity}>
                    Refill
                  </button>
                  <button onClick={() => setEditing(c.servoId)}>Edit</button>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {message && <p className="mute" role="status" style={{ marginTop: 16 }}>{message}</p>}
    </>
  );
}

function SlotForm({ chamber, onDone }: { chamber: ChamberConfig; onDone: () => void }) {
  const { updateChamberConfig } = useMedication();
  const [form, setForm] = useState({
    medicationName: chamber.medicationName,
    pillStrength: chamber.pillStrength,
    maxCapacity: chamber.maxCapacity,
    servoAngleDispense: chamber.servoAngleDispense,
  });

  const save = (e: FormEvent) => {
    e.preventDefault();
    updateChamberConfig(chamber.servoId, {
      ...form,
      currentCount: Math.min(chamber.currentCount, form.maxCapacity),
    });
    onDone();
  };

  return (
    <form onSubmit={save}>
      <label>
        Medication
        <input value={form.medicationName} onChange={(e) => setForm({ ...form, medicationName: e.target.value })} required />
      </label>
      <label>
        Strength
        <input value={form.pillStrength} onChange={(e) => setForm({ ...form, pillStrength: e.target.value })} />
      </label>
      <label>
        Capacity
        <input
          type="number"
          min={1}
          max={99}
          value={form.maxCapacity}
          onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
        />
      </label>
      <label>
        Servo angle (°)
        <input
          type="number"
          min={0}
          max={180}
          value={form.servoAngleDispense}
          onChange={(e) => setForm({ ...form, servoAngleDispense: Number(e.target.value) })}
        />
      </label>
      <p>
        <button type="submit">Save</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </p>
    </form>
  );
}
