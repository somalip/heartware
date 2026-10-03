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
import { XIcon } from '../components/Icons';

export function Dispenser() {
  const { chambers, schedules, logs, dispenseNow, dispenseChain, applyPrescriptionScan } = useMedication();
  const {
    state,
    connectBluetooth,
    connectSimulated,
    disconnect,
    readCharacteristicValue,
    writeCharacteristicValue,
    clearBleLogs,
  } = useHardware();
  const { showToast } = useToast();

  const [editingChamber, setEditingChamber] = useState<ChamberConfig | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerSlotId, setScannerSlotId] = useState<1 | 2 | 3 | 4>(1);
  const [customBleCommand, setCustomBleCommand] = useState('');
  const [showBleConsole, setShowBleConsole] = useState(false);
  const [scanAllDevices, setScanAllDevices] = useState(false);
  const [dispenseCounts, setDispenseCounts] = useState<Record<number, number>>({ 1: 1, 2: 1, 3: 1 });
  const [chainedQueue, setChainedQueue] = useState<(1 | 2 | 3)[]>([]);
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
    const count = dispenseCounts[c.servoId] || 1;
    const res = await dispenseNow(c.servoId, 'app_trigger', false, count);

    if (res.safetyEvaluation && !res.safetyEvaluation.safeToDispense) {
      triggerHaptic('warning');
      setSafetyAlert({ evaluation: res.safetyEvaluation, chamber: c });
      return;
    }

    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleExecuteChain = async () => {
    if (!chainedQueue.length) {
      showToast('Queue is empty. Select bottles to chain.', 'warning');
      return;
    }
    triggerHaptic('heavy');
    const res = await dispenseChain(chainedQueue, 'app_trigger', false);
    if (res.success) {
      showToast(res.message, 'success');
      setChainedQueue([]);
    } else {
      showToast(res.message, 'error');
    }
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
      const res = await connectBluetooth({ acceptAllDevices: scanAllDevices });
      showToast(res.message, res.success ? 'success' : 'error');
    }
  };

  const handleConnectBle = async () => {
    triggerHaptic('selection');
    const res = await connectBluetooth({ acceptAllDevices: scanAllDevices });
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleConnectSimulated = () => {
    triggerHaptic('selection');
    const res = connectSimulated();
    showToast(res.message, 'info');
  };

  const handleReadBle = async () => {
    try {
      triggerHaptic('selection');
      const val = await readCharacteristicValue();
      showToast(`Read from ESP32: "${val}"`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to read characteristic', 'error');
    }
  };

  const handleSendBleCommand = async (cmd?: string) => {
    const payload = cmd || customBleCommand.trim();
    if (!payload) return;

    // If hardware is not yet connected, auto-link virtual ESP32 so tests always succeed
    if (!state.connected) {
      triggerHaptic('light');
      connectSimulated('Hardware link auto-started in simulation mode for test commands.');
      showToast('Virtual ESP32 connected for test command', 'info');
    }

    try {
      triggerHaptic('medium');
      const res = await writeCharacteristicValue(payload);
      showToast(res.message, res.success ? 'success' : 'error');
      if (!cmd) setCustomBleCommand('');
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch command', 'error');
    }
  };

  const slotColors = ['#007aff', '#34c759', '#af52de'];

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

      {/* Bluetooth Hardware & Telemetry Console */}
      <div className="ios-section">
        <div className="ios-section-header">Bluetooth Hardware & Telemetry</div>
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
                    ? 'Connected (BLE Active)'
                    : 'Connected (Simulated)'
                  : 'Disconnected'}
              </div>
              <div className="ios-device-status-meta">
                {state.connected
                  ? `${state.deviceId || 'ESP32_Test'} · GATT Active`
                  : 'Target: ESP32_Test (41200547...)'}
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
              <strong>Web Bluetooth unavailable in this browser.</strong> Use Chrome, Edge, or Bluefy (on iOS) for direct ESP32 Bluetooth pairing. You can also run in Simulated Mode below.
            </div>
          )}

          {/* Connection Actions */}
          {!state.connected ? (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="ios-ble-btn primary"
                  style={{ flex: 1 }}
                  onClick={handleConnectBle}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
                  </svg>
                  <span>Connect ESP32 (BLE)</span>
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

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ios-secondary)', cursor: 'pointer', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  checked={scanAllDevices}
                  onChange={(e) => setScanAllDevices(e.target.checked)}
                />
                <span>Scan all nearby BLE devices (bypass name filter)</span>
              </label>
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

              <button
                type="button"
                className="ios-ble-btn"
                onClick={handleReadBle}
                disabled={state.isReading}
                style={{ flex: 1 }}
              >
                {state.isReading && <IosSpinner size={13} color="var(--ios-label)" />}
                <span>{state.isReading ? 'Reading…' : 'Read Characteristic from ESP32'}</span>
              </button>
            </div>
          )}

          {/* Live Telemetry Readout */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '0.5px solid var(--ios-separator)' }}>
            <div className="ios-ble-card-header">
              <span className="ios-ble-card-title">Characteristic Readout</span>
              <span style={{ fontSize: '11px', color: 'var(--ios-secondary)', fontFamily: 'ui-monospace, monospace' }}>
                UUID: {state.characteristicUuid.slice(0, 8)}…
              </span>
            </div>

            <div className="ios-ble-telemetry-box">
              <span>{state.lastReadValue || 'Waiting for read or incoming notification…'}</span>
              {state.lastReadValue && (
                <span className="ios-ble-tag rx" style={{ marginLeft: '8px' }}>
                  RX
                </span>
              )}
            </div>

            <div className="ios-ble-meta-row">
              <span>Last read: {state.lastReadTimestamp || 'Not read yet'}</span>
              <span>Service: {state.serviceUuid.slice(0, 8)}…</span>
            </div>
          </div>

          {/* Write Command Tool */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '0.5px solid var(--ios-separator)' }}>
            <div className="ios-ble-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="ios-ble-card-title">Send Command to ESP32</span>
              <span className={`ios-badge ${state.connected ? (state.connectionType === 'ble' ? 'green' : 'blue') : 'orange'}`}>
                {state.connected
                  ? state.connectionType === 'ble'
                    ? 'BLE Connected'
                    : 'Virtual Connected'
                  : 'Offline (Auto-links for test)'}
              </span>
            </div>

            <div className="ios-ble-input-group">
              <input
                className="ios-ble-input"
                placeholder={
                  state.connected
                    ? 'Bottle (1, 2, 3) or chain e.g. "123", "11"'
                    : 'Bottle (1, 2, 3) or chain e.g. "123" (Auto-links virtual)'
                }
                value={customBleCommand}
                onChange={(e) => setCustomBleCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendBleCommand();
                  }
                }}
                disabled={state.isWriting}
              />
              <button
                type="button"
                className="ios-ble-btn primary"
                onClick={() => handleSendBleCommand()}
                disabled={state.isWriting || !customBleCommand.trim()}
              >
                {state.isWriting ? 'Sending…' : 'Send'}
              </button>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--ios-secondary)', marginTop: '5px', marginBottom: '8px', lineHeight: 1.4 }}>
              Protocol: Send <strong>1</strong>, <strong>2</strong>, or <strong>3</strong> for Bottles 1–3. Concatenate digits (e.g. <code>123</code>, <code>11</code>) to chain multi-pill dispenses.
            </div>

            {/* Quick Command Chips */}
            <div className="ios-ble-chips">
              {[
                { cmd: '1', label: 'Bottle 1 ("1")' },
                { cmd: '2', label: 'Bottle 2 ("2")' },
                { cmd: '3', label: 'Bottle 3 ("3")' },
                { cmd: '11', label: '2x Bottle 1 ("11")' },
                { cmd: '22', label: '2x Bottle 2 ("22")' },
                { cmd: '33', label: '2x Bottle 3 ("33")' },
                { cmd: '123', label: 'Chain 1-2-3 ("123")' },
                { cmd: 'STATUS', label: 'STATUS' },
                { cmd: 'PING', label: 'PING' },
              ].map((item) => (
                <button
                  key={item.cmd}
                  type="button"
                  className="ios-ble-chip"
                  disabled={state.isWriting}
                  onClick={() => handleSendBleCommand(item.cmd)}
                  title={`Send "${item.cmd}" command to ESP32`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Live Command Response readout */}
            {state.lastReadValue && (
              <div
                style={{
                  marginTop: '10px',
                  background: 'var(--ios-fill)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '11px', color: 'var(--ios-secondary)', whiteSpace: 'nowrap' }}>
                    ESP32 Response:
                  </span>
                  <code style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ios-blue)', wordBreak: 'break-all' }}>
                    {state.lastReadValue}
                  </code>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--ios-tertiary)', whiteSpace: 'nowrap' }}>
                  {state.lastReadTimestamp}
                </span>
              </div>
            )}
          </div>

          {/* Live Activity Console Stream */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '0.5px solid var(--ios-separator)' }}>
            <div className="ios-ble-card-header">
              <button
                type="button"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowBleConsole(!showBleConsole)}
              >
                <span className="ios-ble-card-title">Live Activity Console ({state.bleLogs.length})</span>
                <span style={{ fontSize: '11px', color: 'var(--ios-secondary)' }}>
                  {showBleConsole ? '▲ Hide' : '▼ Show'}
                </span>
              </button>

              {state.bleLogs.length > 0 && showBleConsole && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--ios-secondary)', fontSize: '11px', cursor: 'pointer' }}
                  onClick={clearBleLogs}
                >
                  Clear Log
                </button>
              )}
            </div>

            {showBleConsole && (
              <div className="ios-ble-console">
                {state.bleLogs.length === 0 ? (
                  <div style={{ color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                    No Bluetooth events recorded yet. Connect or read to see live stream.
                  </div>
                ) : (
                  state.bleLogs.map((log) => (
                    <div key={log.id} className="ios-ble-log-entry">
                      <span className="ios-ble-log-time">{log.time}</span>
                      <span className={`ios-ble-tag ${log.direction}`}>{log.direction}</span>
                      <span className="ios-ble-log-msg">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chained Multi-Pill Dispense Section */}
      <div className="ios-section">
        <div className="ios-section-header">Chained Multi-Pill Dispenser</div>
        <div className="ios-ble-card">
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ios-label)' }}>
              Queue Multiple Pills
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--ios-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
              Queue pills from Bottles 1–3 to transmit a single chained BLE command string (e.g. <code>123</code>, <code>11</code>) to the ESP32.
            </div>
          </div>

          {/* Quick Bottle Add Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {chambers.map((c, i) => {
              const color = slotColors[i] || 'var(--ios-blue)';
              return (
                <button
                  key={c.servoId}
                  type="button"
                  className="ios-ble-btn"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 4px',
                    border: '1px solid var(--ios-separator)',
                    backgroundColor: 'var(--ios-fill)',
                  }}
                  onClick={() => {
                    triggerHaptic('light');
                    setChainedQueue(prev => [...prev, c.servoId as 1 | 2 | 3]);
                  }}
                  disabled={state.isDispensing || c.currentCount === 0}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color }}>
                    + Bottle {c.servoId}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--ios-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                    {c.medicationName || '(Unset)'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Queue Pill Badges Container */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'var(--ios-background)',
              border: '0.5px solid var(--ios-separator)',
              minHeight: '46px',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {chainedQueue.length === 0 ? (
              <span style={{ fontSize: '13px', color: 'var(--ios-tertiary)', fontStyle: 'italic' }}>
                Tap "+ Bottle 1/2/3" above to queue pills into a chained command.
              </span>
            ) : (
              chainedQueue.map((bottleId, idx) => {
                const ch = chambers.find(c => c.servoId === bottleId);
                const color = slotColors[bottleId - 1] || 'var(--ios-blue)';
                return (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--ios-fill)',
                      border: `1px solid ${color}50`,
                      borderRadius: '16px',
                      padding: '3px 8px 3px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ color }}>● #{bottleId}</span>
                    <span style={{ color: 'var(--ios-label)', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ch?.medicationName || `Bottle ${bottleId}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setChainedQueue(prev => prev.filter((_, i) => i !== idx));
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ios-secondary)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '0 2px',
                        lineHeight: 1,
                      }}
                      title="Remove from chain"
                    >
                      <XIcon size={14} color="var(--ios-secondary)" />
                    </button>
                  </span>
                );
              })
            )}
          </div>

          {/* Live Command Payload Preview & Actions */}
          {chainedQueue.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--ios-secondary)' }}>
                  BLE Payload to Device:
                </span>
                <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ios-blue)', background: 'var(--ios-fill)', padding: '2px 8px', borderRadius: '6px' }}>
                  "{chainedQueue.join('')}" ({chainedQueue.length} pill{chainedQueue.length > 1 ? 's' : ''})
                </code>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="ios-ble-btn danger"
                  onClick={() => {
                    triggerHaptic('selection');
                    setChainedQueue([]);
                  }}
                  disabled={state.isDispensing}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="ios-ble-btn primary"
                  style={{ flex: 1 }}
                  onClick={handleExecuteChain}
                  disabled={state.isDispensing}
                >
                  {state.isDispensing ? 'Dispensing Chain…' : `Dispense Chained Sequence ("${chainedQueue.join('')}")`}
                </button>
              </div>
            </div>
          )}

          {/* Quick Chained Presets */}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '0.5px solid var(--ios-separator)' }}>
            <span style={{ fontSize: '11px', color: 'var(--ios-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Quick Chained Presets:
            </span>
            <div className="ios-ble-chips" style={{ marginTop: '6px' }}>
              {[
                { label: 'All 3 ("123")', seq: [1, 2, 3] as (1 | 2 | 3)[] },
                { label: '2x Bottle 1 ("11")', seq: [1, 1] as (1 | 2 | 3)[] },
                { label: '2x Bottle 2 ("22")', seq: [2, 2] as (1 | 2 | 3)[] },
                { label: '2x Bottle 3 ("33")', seq: [3, 3] as (1 | 2 | 3)[] },
                { label: 'Bottles 1 & 2 ("12")', seq: [1, 2] as (1 | 2 | 3)[] },
                { label: 'Bottles 2 & 3 ("23")', seq: [2, 3] as (1 | 2 | 3)[] },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="ios-ble-chip"
                  onClick={() => {
                    triggerHaptic('selection');
                    setChainedQueue(p.seq);
                  }}
                  disabled={state.isDispensing}
                  title={`Queue ${p.label}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Medication Bottles Group */}
      <div className="ios-section">
        <div className="ios-section-header">Medication Bottles</div>
        <div className="ios-list">
          {chambers.map((c, i) => {
            const isConfigured = Boolean(c.medicationName.trim());
            const isLow = isConfigured && c.currentCount <= 4 && c.currentCount > 0;
            const isEmpty = isConfigured && c.currentCount === 0;
            const isCurrent = state.isDispensing && state.activeServo === c.servoId;
            const dosesTakenToday = medicationSafetyService.getSlotDailyDoseCount(c.servoId, logs);
            const dailyLimit = c.maxDailyDoses;
            const countToDispense = dispenseCounts[c.servoId] || 1;

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

                  {/* Quantity Stepper for Multi-Pill Dispense */}
                  {isConfigured && !isEmpty && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: 'var(--ios-fill)',
                        borderRadius: '8px',
                        padding: '2px 4px',
                        gap: '2px',
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0 4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--ios-label)',
                        }}
                        onClick={() => {
                          triggerHaptic('light');
                          setDispenseCounts(prev => ({
                            ...prev,
                            [c.servoId]: Math.max(1, (prev[c.servoId] || 1) - 1)
                          }));
                        }}
                        disabled={state.isDispensing || countToDispense <= 1}
                        title="Decrease pills"
                      >
                        −
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '14px', textAlign: 'center' }}>
                        {countToDispense}
                      </span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0 4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--ios-label)',
                        }}
                        onClick={() => {
                          triggerHaptic('light');
                          setDispenseCounts(prev => ({
                            ...prev,
                            [c.servoId]: Math.min(Math.min(5, c.currentCount), (prev[c.servoId] || 1) + 1)
                          }));
                        }}
                        disabled={state.isDispensing || countToDispense >= Math.min(5, c.currentCount)}
                        title="Increase pills"
                      >
                        +
                      </button>
                    </div>
                  )}

                  <button
                    className="ios-nav-action"
                    onClick={() => handleDispense(c)}
                    disabled={state.isDispensing || !isConfigured || isEmpty}
                    title={`Dispense ${countToDispense} pill${countToDispense > 1 ? 's' : ''} (sends "${String(c.servoId).repeat(countToDispense)}")`}
                  >
                    {isCurrent && <IosSpinner size={13} color="var(--ios-blue)" />}
                    {isCurrent ? 'Moving…' : `Dispense${countToDispense > 1 ? ` (${countToDispense})` : ''}`}
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
          Each bottle transmits command 1, 2, or 3 over BLE. Multiple pills send chained digits.
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
    showToast(`Bottle ${chamber.servoId} updated`, 'success');
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
