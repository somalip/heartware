import { FormEvent, useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useHardware } from '../context/HardwareContext';
import { useToast } from '../context/ToastContext';
import { ChamberConfig } from '../types';
import { IosSheet } from '../components/IosSheet';
import { IosSpinner } from '../components/IosSpinner';
import { triggerHaptic } from '../utils/haptics';

export function Dispenser() {
  const { chambers, schedules, dispenseNow } = useMedication();
  const { state, connectBluetooth, disconnect } = useHardware();
  const { showToast } = useToast();
  const [editingChamber, setEditingChamber] = useState<ChamberConfig | null>(null);

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
    const res = await dispenseNow(c.servoId, 'app_trigger');
    showToast(res.message);
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
      <div className="ios-large-title-block">
        <h1 className="ios-large-title">Dispenser</h1>
        <p className="ios-subtitle">Automated Medication System</p>
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
                    {isConfigured
                      ? `${c.currentCount} of ${c.maxCapacity} remaining · ${c.servoAngleDispense}° sweep`
                      : 'Tap Edit to configure medication'}
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
          Each chamber is driven by a precision servo and optical drop sensor. Tap Edit to adjust refill quantity or servo calibration angle.
        </div>
      </div>

      {/* Edit Slot Sheet Modal */}
      {editingChamber && (
        <SlotEditSheet
          chamber={editingChamber}
          onClose={() => setEditingChamber(null)}
        />
      )}
    </>
  );
}

function SlotEditSheet({ chamber, onClose }: { chamber: ChamberConfig; onClose: () => void }) {
  const { updateChamberConfig, refillChamber } = useMedication();
  const { testCalibrateServo } = useHardware();
  const { showToast } = useToast();

  const [name, setName] = useState(chamber.medicationName);
  const [strength, setStrength] = useState(chamber.pillStrength);
  const [capacity, setCapacity] = useState(chamber.maxCapacity);
  const [angle, setAngle] = useState(chamber.servoAngleDispense);
  const [count, setCount] = useState(chamber.currentCount);

  const handleSave = (e?: FormEvent) => {
    if (e) e.preventDefault();
    updateChamberConfig(chamber.servoId, {
      medicationName: name,
      pillStrength: strength,
      maxCapacity: capacity,
      servoAngleDispense: angle,
      currentCount: count,
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
        <div className="ios-section">
          <div className="ios-section-header">Medication Information</div>
          <div className="ios-list">
            <div className="ios-row">
              <div style={{ width: '100px', color: 'var(--ios-secondary)' }}>Name</div>
              <input
                className="ios-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Medication name"
              />
            </div>
            <div className="ios-row">
              <div style={{ width: '100px', color: 'var(--ios-secondary)' }}>Strength</div>
              <input
                className="ios-input"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="Strength (e.g. 10mg)"
              />
            </div>
          </div>
        </div>

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
