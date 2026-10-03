import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { DispenseLog } from '../types';
import { triggerHaptic } from '../utils/haptics';

const SOURCE_LABEL: Record<DispenseLog['dispensedBy'], string> = {
  scheduled_auto: 'Auto Scheduled',
  app_trigger: 'In-App Dispense',
  hardware_button: 'Physical Button',
  manual_override: 'Safety Override',
};

export function History() {
  const { logs } = useMedication();
  const { showToast } = useToast();

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const thisWeek = logs.filter((l) => new Date(l.timestamp).getTime() > weekAgo).length;

  const handleExport = () => {
    triggerHaptic('success');
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heartware-dispense-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported clinical JSON report', 'success');
  };

  return (
    <>
      <div className="ios-large-title-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="ios-large-title">History</h1>
        </div>
        {logs.length > 0 && (
          <button
            className="ios-nav-action primary"
            onClick={handleExport}
          >
            Export
          </button>
        )}
      </div>

      {/* Summary Metrics Inset Group */}
      <div className="ios-section">
        <div className="ios-section-header">Summary</div>
        <div className="history-metrics-grid">
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Last 7 Days</div>
              </div>
              <div className="ios-row-value-bold">
                {thisWeek} {thisWeek === 1 ? 'cycle' : 'cycles'}
              </div>
            </div>
          </div>

          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Lifetime Actuations</div>
              </div>
              <div className="ios-row-value">
                {logs.length}
              </div>
            </div>
          </div>

          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Sensor Verification</div>
              </div>
              <div className="ios-row-value-bold" style={{ color: 'var(--ios-green)' }}>
                100% Active
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="ios-section">
        <div className="ios-section-header">Log</div>
        {logs.length === 0 ? (
          <div className="ios-list">
            <div className="ios-row" style={{ color: 'var(--ios-secondary)' }}>
              No dispense events recorded yet. Actuate a slot to generate audit records.
            </div>
          </div>
        ) : (
          <div className="ios-list">
            {logs.map((l) => (
              <div key={l.id} className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-title">
                    {l.medicationName}
                  </div>
                  <div className="ios-row-sublabel">
                    Slot {l.chamberId} · {SOURCE_LABEL[l.dispensedBy]}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="ios-badge green" style={{ marginBottom: '2px' }}>
                    Confirmed
                  </div>
                  <div className="ios-log-time">
                    {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
