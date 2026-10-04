import { useState, useMemo } from 'react';
import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { useAlert } from '../context/AlertContext';
import { DispenseLog } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { ManualLogModal } from '../components/ManualLogModal';

const SOURCE_LABEL: Record<DispenseLog['dispensedBy'], string> = {
  scheduled_auto: 'Auto Scheduled',
  app_trigger: 'In-App Dispense',
  hardware_button: 'Physical Button',
  manual_override: 'Safety Override',
  manual_entry: 'Manual Entry',
};

type TimeFilter = 'today' | 'week' | 'month' | 'all';

export function History() {
  const { logs, deleteLog } = useMedication();
  const { showToast } = useToast();
  const { showConfirm } = useAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [showLogModal, setShowLogModal] = useState(false);

  // Time boundaries
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;

  // Filter logs by selected time filter
  const timeFilteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const time = new Date(l.timestamp).getTime();
      if (timeFilter === 'today') return time >= startOfToday;
      if (timeFilter === 'week') return time >= weekAgo;
      if (timeFilter === 'month') return time >= monthAgo;
      return true; // 'all'
    });
  }, [logs, timeFilter, startOfToday, weekAgo, monthAgo]);

  // Search filter (matches medication name, active ingredients, notes, source)
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return timeFilteredLogs;

    return timeFilteredLogs.filter((l) => {
      const nameMatch = l.medicationName.toLowerCase().includes(q);
      const notesMatch = l.notes?.toLowerCase().includes(q) ?? false;
      const sourceMatch = SOURCE_LABEL[l.dispensedBy]?.toLowerCase().includes(q) ?? false;
      const ingMatch = l.activeIngredients?.some((i) => i.name.toLowerCase().includes(q)) ?? false;
      return nameMatch || notesMatch || sourceMatch || ingMatch;
    });
  }, [timeFilteredLogs, searchQuery]);

  // Summary Metrics for the active filter view
  const totalDoses = filteredLogs.length;
  const totalPills = filteredLogs.reduce((acc, l) => acc + (l.pillsDispensed || 1), 0);
  const uniqueMeds = new Set(filteredLogs.map((l) => l.medicationName.toLowerCase().trim())).size;

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

  const handleDeleteLog = async (log: DispenseLog) => {
    const confirmed = await showConfirm({
      title: 'Delete Intake Record?',
      message: `Remove the log entry for ${log.medicationName} (${new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      triggerHaptic('warning');
      deleteLog(log.id);
      showToast('Intake record deleted', 'warning');
    }
  };

  // Group logs by Date string
  const groupedLogs = useMemo(() => {
    const groups: { [dateStr: string]: DispenseLog[] } = {};
    for (const log of filteredLogs) {
      const d = new Date(log.timestamp);
      const dateKey = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    }
    return groups;
  }, [filteredLogs, now]);

  return (
    <>
      <div className="ios-large-title-block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="ios-large-title">History</h1>
        </div>
        <div className="ios-header-actions">
          <button
            type="button"
            className="ios-nav-action primary"
            onClick={() => {
              triggerHaptic('light');
              setShowLogModal(true);
            }}
          >
            + Log Med
          </button>
          {logs.length > 0 && (
            <button
              type="button"
              className="ios-nav-action"
              onClick={handleExport}
            >
              Export
            </button>
          )}
        </div>
      </div>

      {/* iOS Search Bar */}
      <div className="ios-search-container">
        <div className="ios-search-bar">
          <svg className="ios-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="ios-search-input"
            placeholder="Search medicine, ingredient, or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="ios-search-clear-btn"
              onClick={() => {
                triggerHaptic('light');
                setSearchQuery('');
              }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Time Range Filter Segmented Control */}
      <div className="ios-segmented">
        {(
          [
            ['today', 'Today'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['all', 'All Time'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`ios-segmented-btn ${timeFilter === key ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('selection');
              setTimeFilter(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Summary Metrics Inset Group */}
      <div className="ios-section">
        <div className="ios-section-header">
          {timeFilter === 'today'
            ? 'Today’s Summary'
            : timeFilter === 'week'
            ? 'Past 7 Days Summary'
            : timeFilter === 'month'
            ? 'Past 30 Days Summary'
            : 'All Time Summary'}
        </div>
        <div className="history-metrics-grid">
          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Doses Taken</div>
              </div>
              <div className="ios-row-value-bold">
                {totalDoses} {totalDoses === 1 ? 'dose' : 'doses'}
              </div>
            </div>
          </div>

          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Total Pills</div>
              </div>
              <div className="ios-row-value">
                {totalPills}
              </div>
            </div>
          </div>

          <div className="ios-list">
            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Unique Meds</div>
              </div>
              <div className="ios-row-value-bold" style={{ color: 'var(--ios-blue)' }}>
                {uniqueMeds}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Entries Grouped by Date */}
      {Object.keys(groupedLogs).length === 0 ? (
        <div className="ios-section">
          <div className="ios-section-header">Records</div>
          <div className="ios-list">
            <div className="ios-row" style={{ color: 'var(--ios-secondary)', textAlign: 'center', padding: '24px 16px', flexDirection: 'column', gap: '8px' }}>
              <div>
                {searchQuery
                  ? `No logs matching "${searchQuery}" found for this period.`
                  : timeFilter === 'today'
                  ? 'No medicine taken yet today.'
                  : timeFilter === 'week'
                  ? 'No medicine logged in the past 7 days.'
                  : 'No medicine intake recorded yet.'}
              </div>
              <button
                type="button"
                className="ios-nav-action primary"
                style={{ margin: '4px auto 0' }}
                onClick={() => setShowLogModal(true)}
              >
                Log Medicine Now
              </button>
            </div>
          </div>
        </div>
      ) : (
        Object.entries(groupedLogs).map(([dateLabel, entries]) => (
          <div key={dateLabel} className="ios-section">
            <div className="ios-section-header">{dateLabel}</div>
            <div className="ios-list">
              {entries.map((l) => (
                <div key={l.id} className="ios-row" style={{ alignItems: 'center' }}>
                  <div className="ios-row-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ios-row-title">{l.medicationName}</span>
                      {l.dispensedBy === 'manual_entry' && (
                        <span className="ios-badge purple" style={{ fontSize: '10px' }}>
                          Manual
                        </span>
                      )}
                    </div>
                    <div className="ios-row-sublabel">
                      {l.chamberId && l.chamberId > 0 ? `Bottle ${l.chamberId}` : 'External'} · {SOURCE_LABEL[l.dispensedBy]}
                      {l.pillsDispensed && l.pillsDispensed > 1 ? ` · ${l.pillsDispensed} pills` : ''}
                      {l.notes ? ` · ${l.notes}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div>
                      <div className="ios-badge green" style={{ marginBottom: '2px' }}>
                        Confirmed
                      </div>
                      <div className="ios-log-time">
                        {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ios-delete-row-btn"
                      onClick={() => handleDeleteLog(l)}
                      title="Delete entry"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Manual Logger Sheet */}
      {showLogModal && <ManualLogModal onClose={() => setShowLogModal(false)} />}
    </>
  );
}
