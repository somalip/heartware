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
  const {
    state,
    connectBluetooth,
    connectSimulated,
    disconnect,
    triggerDispense,
  } = useHardware();
  const { showToast } = useToast();

  const [editingChamber, setEditingChamber] = useState<ChamberConfig | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerSlotId, setScannerSlotId] = useState<1 | 2 | 3 | 4>(1);
  const [safetyAlert, setSafetyAlert] = useState<{
    evaluation: DispenseSafetyEvaluation;
    chamber: ChamberConfig;
  } | null>(null);

  const getNextDoseInfo = () => {
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
    return upcoming
      ? { timeLabel: `Today ${upcoming.time}`, name: upcoming.name }
      : { timeLabel: `Tomorrow ${doses[0].time}`, name: doses[0].name };
  };

  const nextDose = getNextDoseInfo();

  const handleDispense = async (c: ChamberConfig) => {
    triggerHaptic('medium');
    const res = await dispenseNow(c.servoId, 'app_trigger', false, 1);

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

  const handleConnectBle = async () => {
    triggerHaptic('selection');
    const res = await connectBluetooth();
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleConnectSimulated = () => {
    triggerHaptic('selection');
    const res = connectSimulated();
    showToast(res.message, 'info');
  };

  const handleTestDispense = async () => {
    triggerHaptic('medium');
    if (!state.connected) {
      connectSimulated('Hardware link auto-started in simulation mode for test.');
    }
    const targetChamber = chambers.find(c => c.servoId === 1) || chambers[0];
    const res = await triggerDispense(targetChamber, 1);
    if (res.success) {
      showToast('Test pill dispensed', 'success');
    } else {
      showToast(res.message || 'Test dispense failed', 'error');
    }
  };

  const slotColors = ['#007aff', '#34c759', '#af52de'];

  return (
    <>
      <div className="ios-large-title-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="ios-large-title">Dispenser</h1>
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

      {/* Responsive Grid: 2 Columns on Desktop, Single Column on Mobile */}
      <div className="dispenser-desktop-grid">
        {/* Main Column: Status, Medication Bottles, Chained Multi-Pill Dispenser */}
        <div className="dispenser-grid-main">
          {/* Up Next & Status Inset Group */}
          <div className="ios-section">
            <div className="ios-section-header">Status</div>
            <div className="ios-list">
              <div className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-label">Next Scheduled Dose</div>
                  {nextDose && (
                    <div className="ios-row-sublabel">
                      {nextDose.name}
                    </div>
                  )}
                </div>
                <div className={nextDose ? 'ios-row-value-bold' : 'ios-row-value'}>
                  {nextDose ? nextDose.timeLabel : 'None'}
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
          </div>

          {/* Medication Bottles Group */}
          <div className="ios-section">
            <div className="ios-section-header">Bottles</div>
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
                            Bottle {c.servoId} (Unassigned)
                          </span>
                        )}
                      </div>
                      <div className="ios-row-sublabel">
                        {isConfigured ? (
                          <>
                            {c.currentCount} of {c.maxCapacity} remaining · Bottle {c.servoId}
                            {dailyLimit ? ` · Max ${dailyLimit}/day (${dosesTakenToday} taken)` : ''}
                          </>
                        ) : (
                          `Bottle ${c.servoId} · Tap Edit or Scan Rx to configure`
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
          </div>
        </div>

        {/* Side Column: Medication Safety Limits & Dispenser Hardware */}
        <div className="dispenser-grid-side">
          {/* Medication Safety & Daily Intake Limit Tracker */}
          <DailyIntakeSummaryCard />

          {/* Dispenser Hardware Card */}
          <div className="ios-section">
            <div className="ios-section-header">Device</div>
            <div className="ios-ble-card">
              {/* Main Status Row */}
              <div className="ios-device-status-row">
                <div>
                  <div className="ios-device-status-text">
                    <span
                      className="ios-device-status-dot"
                      style={{
                        backgroundColor: state.connected
                          ? state.connectionType === 'ble'
                            ? 'var(--ios-green)'
                            : 'var(--ios-blue)'
                          : 'var(--ios-red)'
                      }}
                    />
                    {state.connected
                      ? state.connectionType === 'ble'
                        ? 'Connected (Bluetooth)'
                        : 'Connected (Simulated)'
                      : 'Disconnected'}
                  </div>
                  <div className="ios-device-status-meta">
                    {state.connected
                      ? `${state.deviceId || 'ESP32'}`
                      : 'Not paired'}
                  </div>
                </div>
                <div className="ios-device-status-right">
                  <div className="ios-device-status-text">
                    {state.connected ? `${state.batteryLevel}%` : '—'}
                  </div>
                  <div className="ios-device-status-meta">Battery</div>
                </div>
              </div>

              {/* Unsupported browser notice if needed */}
              {!state.bluetoothSupported && (
                <div className="ios-ble-notice">
                  <strong>Web Bluetooth unavailable in this browser.</strong> Use Chrome, Edge, or Bluefy (on iOS) for direct ESP32 Bluetooth pairing, or run in Simulated Mode below.
                </div>
              )}

              {/* Connection Actions */}
              {!state.connected ? (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="ios-ble-btn primary"
                    style={{ flex: 1 }}
                    onClick={handleConnectBle}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                    </svg>
                    <span>Connect via Bluetooth</span>
                  </button>

                  <button
                    type="button"
                    className="ios-ble-btn"
                    onClick={handleConnectSimulated}
                    title="Simulate hardware without physical device"
                  >
                    Simulate
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="ios-ble-btn danger"
                    onClick={() => {
                      triggerHaptic('light');
                      disconnect();
                      showToast('Disconnected from hardware', 'info');
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {/* One Test Button to Give One Pill */}
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '0.5px solid var(--ios-separator)' }}>
                <button
                  type="button"
                  className="ios-ble-btn"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: '13.5px',
                  }}
                  onClick={handleTestDispense}
                  disabled={state.isDispensing}
                >
                  {state.isDispensing ? (
                    <IosSpinner size={14} color="var(--ios-label)" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  )}
                  <span>{state.isDispensing ? 'Dispensing…' : 'Dispense 1 test pill'}</span>
                </button>
              </div>
            </div>
          </div>
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
    showToast(`Bottle ${chamber.servoId} updated`, 'success');
    onClose();
  };

  const handleQuickRefill = () => {
    triggerHaptic('success');
    refillChamber(chamber.servoId, capacity);
    setCount(capacity);
    showToast(`Bottle ${chamber.servoId} fully refilled`, 'success');
  };

  return (
    <IosSheet
      title={`Configure Bottle ${chamber.servoId}`}
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
          <div className="ios-section-header">Medication</div>
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
            <div className="ios-section-header">Active ingredients</div>
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
          </div>
        )}

        <div className="ios-section">
          <div className="ios-section-header">Inventory</div>
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
          <div className="ios-section-header">Calibration</div>
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Dispense angle</div>
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
          </div>
        </div>
      </form>
    </IosSheet>
  );
}
