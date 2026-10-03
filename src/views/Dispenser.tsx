import { FormEvent, useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useHardware } from '../context/HardwareContext';
import { useToast } from '../context/ToastContext';
import { ChamberConfig, DispenseSafetyEvaluation, ActiveIngredient } from '../types';
import { IosSheet } from '../components/IosSheet';
import { IosSpinner } from '../components/IosSpinner';
import { DailyIntakeSummaryCard } from '../components/DailyIntakeSummaryCard';
import { CrossIntakeAlertModal } from '../components/CrossIntakeAlertModal';
import { PrescriptionScannerModal } from '../components/PrescriptionScannerModal';
import { medicationSafetyService } from '../services/medicationSafetyService';
import { searchMedications, calculateAutomaticDailyLimit, findBestMatch } from '../data/medicationDatabase';
import { triggerHaptic } from '../utils/haptics';

export function Dispenser() {
  const { chambers, schedules, logs, dispenseNow, applyPrescriptionScan } = useMedication();
  const { state, connectBluetooth, disconnect } = useHardware();
  const { showToast } = useToast();

  const [editingChamber, setEditingChamber] = useState<ChamberConfig | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerSlotId, setScannerSlotId] = useState<1 | 2 | 3 | 4>(1);
  const [safetyAlert, setSafetyAlert] = useState<{
    evaluation: DispenseSafetyEvaluation;
    chamber: ChamberConfig;
  } | null>(null);

  const nextDoseText = () => {
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
    if (!doses.length) return 'None scheduled';
    const upcoming = doses.find((d) => d.min > nowMin);
    return upcoming ? `${upcoming.time} · ${upcoming.name}` : `Tomorrow ${doses[0].time} · ${doses[0].name}`;
  };

  const handleDispense = async (c: ChamberConfig) => {
    triggerHaptic('medium');
    const res = await dispenseNow(c.servoId, 'app_trigger', false);

    if (res.safetyEvaluation && !res.safetyEvaluation.safeToDispense) {
      triggerHaptic('warning');
      setSafetyAlert({ evaluation: res.safetyEvaluation, chamber: c });
      return;
    }

    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleEmergencyOverrideDispense = async () => {
    if (!safetyAlert) return;
    const { chamber } = safetyAlert;
    setSafetyAlert(null);
    triggerHaptic('heavy');
    const res = await dispenseNow(chamber.servoId, 'manual_override', true);
    showToast(`Override dispense: ${res.message}`, res.success ? 'warning' : 'error');
  };

  const toggleConnection = async () => {
    triggerHaptic('selection');
    if (state.connected) {
      disconnect();
      showToast('ESP32 Disconnected', 'warning');
    } else {
      const res = await connectBluetooth();
      showToast(res.message, res.success ? 'success' : 'error');
    }
  };

  const slotColors = ['#007aff', '#34c759', '#af52de', '#ff9500'];

  return (
    <>
      <div className="ios-large-title-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="ios-large-title">Dispenser</h1>
          <p className="ios-subtitle">Automated Medication System</p>
        </div>
        <button
          type="button"
          className="ios-scan-header-btn"
          onClick={() => {
            triggerHaptic('light');
            setShowScanner(true);
          }}
          title="Scan Prescription Label"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>Scan Rx</span>
        </button>
      </div>

      {/* Up Next & Status Inset Group */}
      <div className="ios-section">
        <div className="ios-section-header">Status & Upcoming</div>
        <div className="ios-list">
          <div className="ios-row">
            <div className="ios-row-content">
              <div className="ios-row-label">Next Scheduled Dose</div>
              <div className="ios-row-sublabel">Calculated from timetable</div>
            </div>
            <div className="ios-row-value-bold">
              {nextDoseText()}
            </div>
          </div>

          <div className="ios-row">
            <div className="ios-row-content">
              <div className="ios-row-label">Hardware Link</div>
              <div className="ios-row-sublabel">
                {state.connected ? `${state.deviceId} (BLE Active)` : 'Not Paired'}
              </div>
            </div>
            <label className="ios-switch">
              <input
                type="checkbox"
                checked={state.connected}
                onChange={toggleConnection}
              />
              <span className="ios-switch-slider" />
            </label>
          </div>

          <div className="ios-row">
            <div className="ios-row-content">
              <div className="ios-row-label">Battery Level</div>
            </div>
            <div className="ios-row-value">
              {state.connected ? `${state.batteryLevel}% (LiPo)` : '—'}
            </div>
          </div>
        </div>
        <div className="ios-section-footer">
          Connected over low-energy GATT channel. Schedules cache to ESP32 for offline accuracy.
        </div>
      </div>

      {/* Medication Safety & Daily Intake Limit Tracker */}
      <DailyIntakeSummaryCard />

      {/* Device Status */}
      <div className="ios-section">
        <div className="ios-section-header">Device Status</div>
        <div className="ios-device-card">
          <div className="ios-device-status-row">
            <div>
              <div className="ios-device-status-text">
                <span className="ios-device-status-dot" style={{ backgroundColor: state.connected ? 'var(--ios-green)' : 'var(--ios-red)' }} />
                {state.connected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="ios-device-status-meta">
                {state.connected ? `${state.deviceId || 'ESP32'} · BLE Active` : 'Not Paired'}
              </div>
            </div>
            <div className="ios-device-status-right">
              <div className="ios-device-status-text">{state.connected ? `${state.batteryLevel}%` : '—'}</div>
              <div className="ios-device-status-meta">Battery</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Servo Slots Group */}
      <div className="ios-section">
        <div className="ios-section-header">Medication Chambers</div>
        <div className="ios-list">
          {chambers.map((c, i) => {
            const isConfigured = Boolean(c.medicationName.trim());
            const isLow = isConfigured && c.currentCount <= 4 && c.currentCount > 0;
            const isEmpty = isConfigured && c.currentCount === 0;
            const isCurrent = state.isDispensing && state.activeServo === c.servoId;
            const dosesTakenToday = medicationSafetyService.getSlotDailyDoseCount(c.servoId, logs);
            const dailyLimit = c.maxDailyDoses;

            return (
              <div key={c.servoId} className="ios-row with-icon">
                <div
                  className="ios-icon-box"
                  style={{ backgroundColor: isConfigured ? slotColors[i] : 'var(--ios-tertiary)' }}
                >
                  {c.servoId}
                </div>
                <div className="ios-row-content">
                  <div className="ios-row-label" style={{ fontWeight: 600 }}>
                    {isConfigured ? (
                      <>
                        {c.medicationName}{' '}
                        {c.pillStrength && (
                          <span style={{ fontWeight: 400, color: 'var(--ios-secondary)' }}>{c.pillStrength}</span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--ios-secondary)', fontWeight: 500 }}>
                        Slot {c.servoId} (Unassigned)
                      </span>
                    )}
                  </div>
                  <div className="ios-row-sublabel">
                    {isConfigured ? (
                      <>
                        {c.currentCount} of {c.maxCapacity} remaining
                        {dailyLimit ? ` · Max ${dailyLimit}/day (${dosesTakenToday} taken today)` : ''}
                      </>
                    ) : (
                      'Tap Edit or Scan Rx to configure'
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: 'auto' }}>
                  {!isConfigured ? (
                    <span className="ios-badge" style={{ backgroundColor: 'var(--ios-fill)', color: 'var(--ios-secondary)' }}>
                      Unset
                    </span>
                  ) : isEmpty ? (
                    <span className="ios-badge red">Empty</span>
                  ) : isLow ? (
                    <span className="ios-badge orange">Low</span>
                  ) : dailyLimit && dosesTakenToday >= dailyLimit ? (
                    <span className="ios-badge red">Limit Met</span>
                  ) : (
                    <span className="ios-badge green">Ready</span>
                  )}

                  <button
                    className="ios-nav-action"
                    onClick={() => handleDispense(c)}
                    disabled={state.isDispensing || !isConfigured || isEmpty}
                  >
                    {isCurrent && <IosSpinner size={13} color="var(--ios-blue)" />}
                    {isCurrent ? 'Moving…' : 'Dispense'}
                  </button>

                  <button
                    className="ios-nav-action"
                    onClick={() => {
                      triggerHaptic('light');
                      setEditingChamber(c);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="ios-section-footer">
          Each chamber is monitored for active ingredient cumulative intake limits.
        </div>
      </div>

      {/* Edit Slot Sheet Modal */}
      {editingChamber && (
        <SlotEditSheet
          chamber={editingChamber}
          onOpenScanner={() => {
            setScannerSlotId(editingChamber.servoId);
            setEditingChamber(null);
            setShowScanner(true);
          }}
          onClose={() => setEditingChamber(null)}
        />
      )}

      {/* Cross-Intake Overdose Risk Safety Modal */}
      {safetyAlert && (
        <CrossIntakeAlertModal
          evaluation={safetyAlert.evaluation}
          targetMedicationName={safetyAlert.chamber.medicationName}
          targetSlotId={safetyAlert.chamber.servoId}
          onCancel={() => setSafetyAlert(null)}
          onConfirmOverride={handleEmergencyOverrideDispense}
        />
      )}

      {/* Prescription Scanner Modal */}
      {showScanner && (
        <PrescriptionScannerModal
          chambers={chambers}
          initialSlotId={scannerSlotId}
          onApply={(data) => {
            applyPrescriptionScan(data);
            showToast(`Slot ${data.slotId} configured for ${data.medicationName}`, 'success');
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}

function SlotEditSheet({
  chamber,
  onOpenScanner,
  onClose,
}: {
  chamber: ChamberConfig;
  onOpenScanner: () => void;
  onClose: () => void;
}) {
  const { updateChamberConfig, refillChamber } = useMedication();
  const { testCalibrateServo } = useHardware();
  const { showToast } = useToast();

  const [name, setName] = useState(chamber.medicationName);
  const [strength, setStrength] = useState(chamber.pillStrength);
  const [capacity, setCapacity] = useState(chamber.maxCapacity);
  const [angle, setAngle] = useState(chamber.servoAngleDispense);
  const [count, setCount] = useState(chamber.currentCount);
  const [activeIngredients, setActiveIngredients] = useState<ActiveIngredient[]>(
    chamber.activeIngredients || []
  );
  const [maxDailyDoses, setMaxDailyDoses] = useState<number>(
    chamber.maxDailyDoses || 6
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = searchMedications(name).slice(0, 5);

  const handleSelectMedication = (med: typeof suggestions[0]) => {
    setName(med.brandName);
    setStrength(med.defaultStrength);
    setActiveIngredients(med.activeIngredients);
    const auto = calculateAutomaticDailyLimit(med);
    setMaxDailyDoses(auto.maxDailyUnits);
    setShowSuggestions(false);
    triggerHaptic('selection');
  };

  const handleSave = (e?: FormEvent) => {
    if (e) e.preventDefault();

    // If active ingredients wasn't manually set, try auto-matching from database
    let ingredients = activeIngredients;
    let limit = maxDailyDoses;
    if (ingredients.length === 0 && name.trim()) {
      const match = findBestMatch(name);
      if (match) {
        ingredients = match.activeIngredients;
        if (!chamber.maxDailyDoses) {
          limit = calculateAutomaticDailyLimit(match).maxDailyUnits;
        }
      }
    }

    updateChamberConfig(chamber.servoId, {
      medicationName: name,
      pillStrength: strength,
      maxCapacity: capacity,
      servoAngleDispense: angle,
      currentCount: count,
      activeIngredients: ingredients,
      maxDailyDoses: limit,
    });
    showToast(`Slot ${chamber.servoId} updated`, 'success');
    onClose();
  };

  const handleTestServo = async () => {
    triggerHaptic('medium');
    const res = await testCalibrateServo(chamber.servoId, angle);
    showToast(res, 'info');
  };

  const handleQuickRefill = () => {
    triggerHaptic('success');
    refillChamber(chamber.servoId, capacity);
    setCount(capacity);
    showToast(`Slot ${chamber.servoId} fully refilled`, 'success');
  };

  return (
    <IosSheet
      title={`Configure Slot ${chamber.servoId}`}
      leftActionText="Cancel"
      onLeftAction={onClose}
      rightActionText="Done"
      onRightAction={handleSave}
      onClose={onClose}
    >
      <form onSubmit={handleSave}>
        {/* Quick Scan Action */}
        <div style={{ padding: '0 16px 12px' }}>
          <button
            type="button"
            className="ios-scan-shortcut-btn"
            onClick={onOpenScanner}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>Scan Bottle Label to Auto-Fill Details</span>
          </button>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">Medication Information & Database</div>
          <div className="ios-list">
            <div className="ios-row" style={{ position: 'relative' }}>
              <div style={{ width: '100px', color: 'var(--ios-secondary)' }}>Name</div>
              <input
                className="ios-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search medication (e.g. DayQuil)"
              />
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && name.trim().length > 1 && suggestions.length > 0 && (
              <div className="ios-suggestions-dropdown">
                {suggestions.map((med) => (
                  <div
                    key={med.id}
                    className="ios-suggestion-item"
                    onClick={() => handleSelectMedication(med)}
                  >
                    <div className="ios-suggestion-brand">{med.brandName}</div>
                    <div className="ios-suggestion-generic">
                      {med.genericName} · {med.defaultStrength}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="ios-row">
              <div style={{ width: '100px', color: 'var(--ios-secondary)' }}>Strength</div>
              <input
                className="ios-input"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="Strength (e.g. 325mg / 10mg / 5mg)"
              />
            </div>

            <div className="ios-row">
              <div style={{ width: '100px', color: 'var(--ios-secondary)' }}>Daily Limit</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  max="24"
                  className="ios-input"
                  style={{ width: '70px', textAlign: 'center' }}
                  value={maxDailyDoses}
                  onChange={(e) => setMaxDailyDoses(Number(e.target.value))}
                />
                <span style={{ fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  doses max / day (Automatic limit)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Display Active Ingredients */}
        {activeIngredients.length > 0 && (
          <div className="ios-section">
            <div className="ios-section-header">Monitored Active Ingredients</div>
            <div className="ios-list">
              {activeIngredients.map((ing, i) => (
                <div key={i} className="ios-row">
                  <div className="ios-row-content">
                    <div className="ios-row-label">{ing.name}</div>
                    <div className="ios-row-sublabel">{ing.amountMg} mg per dose</div>
                  </div>
                  <span className="ios-badge green">Auto-Tracked</span>
                </div>
              ))}
            </div>
            <div className="ios-section-footer">
              Heartware monitors cumulative intake of these ingredients across all 4 slots.
            </div>
          </div>
        )}

        <div className="ios-section">
          <div className="ios-section-header">Inventory & Capacity</div>
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Current Pills</div>
              </div>
              <div className="ios-stepper">
                <button
                  type="button"
                  className="ios-stepper-btn"
                  onClick={() => {
                    triggerHaptic('light');
                    setCount(Math.max(0, count - 1));
                  }}
                >
                  −
                </button>
                <div className="ios-stepper-divider" />
                <span className="ios-stepper-value">{count}</span>
                <div className="ios-stepper-divider" />
                <button
                  type="button"
                  className="ios-stepper-btn"
                  onClick={() => {
                    triggerHaptic('light');
                    setCount(Math.min(capacity, count + 1));
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Max Chamber Size</div>
              </div>
              <div className="ios-stepper">
                <button
                  type="button"
                  className="ios-stepper-btn"
                  onClick={() => {
                    triggerHaptic('light');
                    setCapacity(Math.max(5, capacity - 5));
                  }}
                >
                  −
                </button>
                <div className="ios-stepper-divider" />
                <span className="ios-stepper-value">{capacity}</span>
                <div className="ios-stepper-divider" />
                <button
                  type="button"
                  className="ios-stepper-btn"
                  onClick={() => {
                    triggerHaptic('light');
                    setCapacity(Math.min(60, capacity + 5));
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div className="ios-row interactive" onClick={handleQuickRefill}>
              <button type="button" className="ios-row-action">
                Refill to Full ({capacity} Pills)
              </button>
            </div>
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">Servo Motor Calibration</div>
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Actuation Sweep Angle</div>
                <div className="ios-row-sublabel">Standard is 90° for single-compartment drop</div>
              </div>
              <div className="ios-row-value-bold">{angle}°</div>
            </div>
            <div className="ios-row">
              <input
                type="range"
                min="45"
                max="180"
                step="5"
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="ios-range-input"
              />
            </div>
            <div className="ios-row interactive" onClick={handleTestServo}>
              <button type="button" className="ios-row-action">
                Test Servo Rotation Sweep ({angle}°)
              </button>
            </div>
          </div>
        </div>
      </form>
    </IosSheet>
  );
}
