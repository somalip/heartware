import React, { useState } from 'react';
import { useMedication } from '../context/MedicationContext';
import { medicationSafetyService } from '../services/medicationSafetyService';
import { MedicationSafetyInfoModal } from './MedicationSafetyInfoModal';
import { triggerHaptic } from '../utils/haptics';
import { InfoIcon, AlertTriangleIcon } from './Icons';

export const DailyIntakeSummaryCard: React.FC = () => {
  const { chambers, logs } = useMedication();
  const [expanded, setExpanded] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // If user has no active configured medications in any chamber, completely hide
  const hasConfiguredChambers = chambers.some((c) => c.medicationName.trim().length > 0);
  if (!hasConfiguredChambers) {
    return null;
  }

  const conflicts = medicationSafetyService.checkChamberConflicts(chambers);
  const intakeList = medicationSafetyService.calculateDailyIntake(logs, chambers);

  // If no conflicts between assigned medications and no doses taken today, do not render
  if (conflicts.length === 0 && intakeList.length === 0) {
    return null;
  }

  return (
    <>
      <div className="ios-section safety-summary-section">
        <div className="ios-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Medication Safety & Daily Limits</span>
            <button
              type="button"
              className="ios-text-button"
              onClick={() => {
                triggerHaptic('light');
                setShowInfoModal(true);
              }}
              style={{
                fontSize: '13px',
                color: 'var(--ios-blue)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '2px 4px',
              }}
              title="Clinical sources and calculation methodology"
            >
              <InfoIcon size={14} color="var(--ios-blue)" />
              <span style={{ textDecoration: 'underline' }}>Info</span>
            </button>
          </div>
          {intakeList.length > 0 && (
            <button
              type="button"
              className="ios-text-button"
              onClick={() => {
                triggerHaptic('light');
                setExpanded(!expanded);
              }}
              style={{ fontSize: '13px', color: 'var(--ios-blue)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {expanded ? 'Show Less' : 'Details'}
            </button>
          )}
        </div>

      {/* Cross-Intake Conflict Warning Banner */}
      {conflicts.length > 0 && (
        <div className="ios-safety-warning-banner">
          <AlertTriangleIcon size={20} color="var(--ios-orange)" />
          <div className="ios-safety-warning-body">
            <div className="ios-safety-warning-title">Cross-Intake Conflict Detected</div>
            {conflicts.map((c, i) => (
              <div key={i} className="ios-safety-warning-text">
                {c.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Ingredients 24h Intake Meters */}
      {intakeList.length > 0 && (
        <div className="ios-list">
          {intakeList.map((item) => {
            const badgeClass =
              item.status === 'exceeded' ? 'red' : item.status === 'warning' ? 'orange' : 'green';

            return (
              <div key={item.ingredientName} className="ios-intake-card-row">
                <div className="ios-intake-header">
                  <div>
                    <span className="ios-intake-name">{item.ingredientName}</span>
                    <span className="ios-intake-stat">
                      {item.takenTodayMg} / {item.maxDailyMg} mg ({item.percent}%)
                    </span>
                  </div>
                  <span className={`ios-badge ${badgeClass}`}>
                    {item.status === 'exceeded'
                      ? 'Limit Exceeded'
                      : item.status === 'warning'
                      ? 'High Intake'
                      : 'Safe'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="ios-progress-track">
                  <div
                    className={`ios-progress-fill ${badgeClass}`}
                    style={{ width: `${Math.min(100, item.percent)}%` }}
                  />
                </div>

                {/* Breakdown of slots contributing to this ingredient */}
                {(expanded || item.status !== 'safe') && (
                  <div className="ios-intake-contributions">
                    {item.slotsContributing.map((slot) => (
                      <div key={slot.servoId} className="ios-intake-slot-chip">
                        <span className="ios-slot-chip-dot" />
                        <span>
                          Slot {slot.servoId} ({slot.medicationName}): {slot.doseCount} dose{slot.doseCount > 1 ? 's' : ''} ({slot.amountMg} mg)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="ios-section-footer" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span>
          Heartware tracks active ingredients across all 4 dispenser slots to prevent cumulative overdose (e.g. DayQuil + Tylenol).
        </span>
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setShowInfoModal(true);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--ios-blue)',
            fontSize: '12.5px',
            textAlign: 'left',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          How are limits calculated? Review public FDA/NIH sources & formulas →
        </button>
      </div>
    </div>

    {showInfoModal && (
      <MedicationSafetyInfoModal onClose={() => setShowInfoModal(false)} />
    )}
  </>
  );
};
