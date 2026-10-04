import { FormEvent, useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { useAlert } from '../context/AlertContext';
import { ChamberConfig } from '../types';
import { IosSheet } from '../components/IosSheet';
import { PrescriptionScannerModal } from '../components/PrescriptionScannerModal';
import { triggerHaptic } from '../utils/haptics';

import { medicationSafetyService } from '../services/medicationSafetyService';
import { CrossIntakeAlertModal } from '../components/CrossIntakeAlertModal';
import { DispenseSafetyEvaluation } from '../types';

type SlotId = ChamberConfig['servoId'];

export function Schedule() {
  const { schedules, chambers, logs, deleteSchedule, dispenseNow, applyPrescriptionScan } = useMedication();
  const { showToast } = useToast();
  const { showConfirm } = useAlert();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scheduleCounts, setScheduleCounts] = useState<Record<string, number>>({});
  const [safetyAlert, setSafetyAlert] = useState<{
    evaluation: DispenseSafetyEvaluation;
    chamber: ChamberConfig;
    requestedCount: number;
  } | null>(null);

  const nameFor = (id: SlotId, fallback: string) =>
    chambers.find((c) => c.servoId === id)?.medicationName ?? fallback;

  const sorted = [...schedules].sort((a, b) => (a.times[0] ?? '').localeCompare(b.times[0] ?? ''));

  const handleManualDispense = async (chamberId: SlotId, count = 1) => {
    triggerHaptic('medium');
    const chamber = chambers.find((c) => c.servoId === chamberId);
    const res = await dispenseNow(chamberId, 'app_trigger', false, count);

    if (res.safetyEvaluation && !res.safetyEvaluation.safeToDispense && chamber) {
      triggerHaptic('warning');
      setSafetyAlert({ evaluation: res.safetyEvaluation, chamber, requestedCount: count });
      return;
    }

    showToast(res.message, res.success ? 'success' : 'warning');
  };

  const handleEmergencyOverrideDispense = async () => {
    if (!safetyAlert) return;
    const { chamber, requestedCount } = safetyAlert;
    setSafetyAlert(null);
    triggerHaptic('heavy');
    const res = await dispenseNow(chamber.servoId, 'manual_override', true, requestedCount);
    showToast(`Override dispense: ${res.message}`, res.success ? 'warning' : 'error');
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="ios-scan-header-btn"
            onClick={() => {
              triggerHaptic('light');
              setShowScanner(true);
            }}
            title="Scan Prescription Label"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Scan Rx</span>
          </button>

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
      </div>

      <div className="ios-section">
        <div className="ios-section-header">Routines</div>
        {sorted.length === 0 ? (
          <div className="ios-list">
            <div className="ios-row" style={{ color: 'var(--ios-secondary)' }}>
              No dosing routines scheduled. Tap + or Scan Rx to add one.
            </div>
          </div>
        ) : (
          <div className="schedule-cards-grid">
            {sorted.map((s) => {
              const medName = nameFor(s.chamberId, s.medicationName);
              const chamber = chambers.find((c) => c.servoId === s.chamberId);
              const dailyLimit = s.maxDailyDoses || chamber?.maxDailyDoses;
              const ingredients = s.activeIngredients || chamber?.activeIngredients;

              return (
                <div key={s.id} className="ios-list" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div className="ios-row" style={{ alignItems: 'flex-start', flex: 1 }}>
                    <div className="ios-row-content">
                      <div className="ios-row-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{medName}</span>
                        {dailyLimit && (
                          <span className="ios-badge" style={{ backgroundColor: 'var(--ios-fill)', color: 'var(--ios-secondary)', fontSize: '11px' }}>
                            Max {dailyLimit}/day
                          </span>
                        )}
                      </div>
                      <div className="ios-row-sublabel" style={{ marginTop: '4px' }}>
                        {s.dosage} · Bottle {s.chamberId} {chamber ? `(${chamber.currentCount} left)` : ''}
                        {s.instructions ? ` · ${s.instructions}` : ''}
                      </div>
                      {ingredients && ingredients.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--ios-secondary)', marginTop: '6px', lineHeight: 1.3 }}>
                          Active: {ingredients.map((i) => `${i.name} ${i.amountMg}mg`).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="ios-badge" style={{ backgroundColor: 'var(--ios-fill)', color: 'var(--ios-label)', fontWeight: 600, flexShrink: 0 }}>
                      {s.times.join(', ')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '8px 16px 12px', borderTop: '0.5px solid var(--ios-separator)', flexWrap: 'wrap' }}>
                    {chamber && chamber.currentCount > 0 && (
                      <div className="ios-pill-count-group" role="group" aria-label="Select pill count">
                        {[1, 2, 3].map((num) => {
                          const hasInv = chamber.currentCount >= num;
                          const safetyEval = medicationSafetyService.validateDispenseSafety(s.chamberId, chambers, logs, num);
                          const isSafe = hasInv && safetyEval.safeToDispense;
                          const isSelected = (scheduleCounts[s.id] ?? 1) === num;

                          let title = `${num} pill${num > 1 ? 's' : ''}`;
                          if (!hasInv) {
                            title = `Only ${chamber.currentCount} pill${chamber.currentCount === 1 ? '' : 's'} available in inventory`;
                          } else if (!safetyEval.safeToDispense) {
                            title = safetyEval.blockReason || 'Exceeds safety limit';
                          }

                          return (
                            <button
                              key={num}
                              type="button"
                              className={`ios-pill-count-btn ${isSelected ? 'active' : ''}`}
                              disabled={!hasInv || !isSafe}
                              onClick={() => {
                                triggerHaptic('selection');
                                setScheduleCounts((prev) => ({ ...prev, [s.id]: num }));
                              }}
                              title={title}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      className="ios-nav-action primary"
                      disabled={!chamber || chamber.currentCount < (scheduleCounts[s.id] ?? 1)}
                      onClick={() => handleManualDispense(s.chamberId, scheduleCounts[s.id] ?? 1)}
                    >
                      Dispense {scheduleCounts[s.id] ?? 1}x
                    </button>
                    <button
                      type="button"
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
      </div>

      {/* Safety Alert Modal for Schedule View */}
      {safetyAlert && (
        <CrossIntakeAlertModal
          evaluation={safetyAlert.evaluation}
          targetMedicationName={safetyAlert.chamber.medicationName}
          targetSlotId={safetyAlert.chamber.servoId}
          onCancel={() => setSafetyAlert(null)}
          onConfirmOverride={handleEmergencyOverrideDispense}
        />
      )}

      {showAddSheet && (
        <AddScheduleSheet
          chambers={chambers}
          onClose={() => setShowAddSheet(false)}
        />
      )}

      {showScanner && (
        <PrescriptionScannerModal
          chambers={chambers}
          onApply={(data) => {
            applyPrescriptionScan(data);
            showToast(`Prescription for ${data.medicationName} added to timetable`, 'success');
          }}
          onClose={() => setShowScanner(false)}
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

  const targetChamber = chambers.find((c) => c.servoId === chamberId);
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
      activeIngredients: targetChamber?.activeIngredients,
      maxDailyDoses: targetChamber?.maxDailyDoses,
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
          <div className="ios-section-header">Target Bottle</div>
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-detail-label">Dispenser Bottle</div>
              <select
                className="ios-input"
                value={chamberId}
                onChange={(e) => setChamberId(Number(e.target.value) as SlotId)}
              >
                {chambers.map((c) => (
                  <option key={c.servoId} value={c.servoId}>
                    Bottle {c.servoId}: {c.medicationName ? `${c.medicationName} (${c.pillStrength || 'standard'})` : 'Unassigned'}
                  </option>
                ))}
              </select>
            </div>

            {targetChamber?.maxDailyDoses && (
              <div className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-label">Automatic Daily Safe Cap</div>
                  <div className="ios-row-sublabel">
                    {targetChamber.activeIngredients?.map((i) => `${i.name} ${i.amountMg}mg`).join(', ') || 'Monitored'}
                  </div>
                </div>
                <span className="ios-badge green">Max {targetChamber.maxDailyDoses} doses/day</span>
              </div>
            )}

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
          <div className="ios-section-header">Notes</div>
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
