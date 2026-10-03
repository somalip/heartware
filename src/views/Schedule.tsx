import { FormEvent, useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { useAlert } from '../context/AlertContext';
import { ChamberConfig } from '../types';
import { IosSheet } from '../components/IosSheet';
import { triggerHaptic } from '../utils/haptics';

type SlotId = ChamberConfig['servoId'];

export function Schedule() {
  const { schedules, chambers, deleteSchedule, dispenseNow } = useMedication();
  const { showToast } = useToast();
  const { showConfirm } = useAlert();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const nameFor = (id: SlotId, fallback: string) =>
    chambers.find((c) => c.servoId === id)?.medicationName ?? fallback;

  const sorted = [...schedules].sort((a, b) => (a.times[0] ?? '').localeCompare(b.times[0] ?? ''));

  const handleManualDispense = async (chamberId: SlotId) => {
    triggerHaptic('medium');
    const res = await dispenseNow(chamberId, 'app_trigger');
    showToast(res.message);
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm({
      title: 'Remove Routine?',
      message: `Are you sure you want to remove the scheduled dosing routine for ${name}?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      deleteSchedule(id);
      showToast('Routine removed from schedule', 'warning');
    }
  };

  return (
    <>
      <div className="ios-large-title-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="ios-large-title">Schedule</h1>
          <p className="ios-subtitle">Dosing Timetable</p>
        </div>
        <button
          className="ios-add-button"
          onClick={() => {
            triggerHaptic('light');
            setShowAddSheet(true);
          }}
          title="Add Routine"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="ios-section">
        <div className="ios-section-header">Active Regimens</div>
        {sorted.length === 0 ? (
          <div className="ios-list">
            <div className="ios-row" style={{ color: 'var(--ios-secondary)' }}>
              No dosing routines scheduled. Tap + to add one.
            </div>
          </div>
        ) : (
          <div className="ios-list">
            {sorted.map((s) => {
              const medName = nameFor(s.chamberId, s.medicationName);
              const chamber = chambers.find((c) => c.servoId === s.chamberId);
              return (
                <div key={s.id} className="ios-row">
                  <div className="ios-row-content">
                    <div className="ios-row-title">
                      {medName}
                    </div>
                    <div className="ios-row-sublabel">
                      {s.dosage} · Slot {s.chamberId} {chamber ? `(${chamber.currentCount} left)` : ''}
                      {s.instructions ? ` · ${s.instructions}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: 'auto' }}>
                    <div className="ios-badge" style={{ backgroundColor: 'var(--ios-fill)', color: 'var(--ios-label)', fontWeight: 600 }}>
                      {s.times.join(', ')}
                    </div>
                    <button
                      className="ios-nav-action"
                      onClick={() => handleManualDispense(s.chamberId)}
                    >
                      Dispense
                    </button>
                    <button
                      className="ios-nav-action"
                      style={{ color: 'var(--ios-red)' }}
                      onClick={() => handleDelete(s.id, medName)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="ios-section-footer">
          Scheduled doses trigger the corresponding servo at scheduled minutes with an audible buzzer alert and IR confirmation.
        </div>
      </div>

      {showAddSheet && (
        <AddScheduleSheet
          chambers={chambers}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </>
  );
}

function AddScheduleSheet({
  chambers,
  onClose,
}: {
  chambers: ChamberConfig[];
  onClose: () => void;
}) {
  const { addSchedule } = useMedication();
  const { showToast } = useToast();

  const [chamberId, setChamberId] = useState<SlotId>(1);
  const [time, setTime] = useState('08:00');
  const [asNeeded, setAsNeeded] = useState(false);
  const [dosage, setDosage] = useState('1 tablet');
  const [instructions, setInstructions] = useState('');

  const nameFor = (id: SlotId) =>
    chambers.find((c) => c.servoId === id)?.medicationName ?? `Slot ${id}`;

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    addSchedule({
      medicationName: nameFor(chamberId),
      dosage,
      chamberId,
      times: [asNeeded ? 'As needed' : time],
      instructions,
      prescribedBy: '',
      active: true,
      shape: 'round',
      pillColor: '#111',
    });
    showToast('New routine added to schedule', 'success');
    onClose();
  };

  return (
    <IosSheet
      title="New Dosing Schedule"
      leftActionText="Cancel"
      onLeftAction={onClose}
      rightActionText="Add"
      onRightAction={handleSubmit}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <div className="ios-section">
          <div className="ios-section-header">Target Chamber</div>
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-detail-label">Servo Chamber</div>
              <select
                className="ios-input"
                value={chamberId}
                onChange={(e) => setChamberId(Number(e.target.value) as SlotId)}
              >
                {chambers.map((c) => (
                  <option key={c.servoId} value={c.servoId}>
                    Slot {c.servoId}: {c.medicationName ? `${c.medicationName} (${c.pillStrength || 'standard'})` : 'Unassigned'}
                  </option>
                ))}
              </select>
            </div>

            <div className="ios-row">
              <div className="ios-detail-label">Dosage</div>
              <input
                className="ios-input"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="e.g. 1 tablet (10mg)"
                required
              />
            </div>
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">Timing</div>
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Dispense As-Needed (PRN)</div>
                <div className="ios-row-sublabel">Emergency or pain relief doses</div>
              </div>
              <label className="ios-switch">
                <input
                  type="checkbox"
                  checked={asNeeded}
                  onChange={(e) => setAsNeeded(e.target.checked)}
                />
                <span className="ios-switch-slider" />
              </label>
            </div>

            {!asNeeded && (
              <div className="ios-row">
                <div className="ios-detail-label">Dose Time</div>
                <input
                  type="time"
                  className="ios-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required={!asNeeded}
                />
              </div>
            )}
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">Notes & Instructions</div>
          <div className="ios-list">
            <div className="ios-row">
              <input
                className="ios-input"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Take with 250ml water after meal"
              />
            </div>
          </div>
        </div>
      </form>
    </IosSheet>
  );
}
