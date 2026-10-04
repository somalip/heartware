import React from 'react';
import { useMedication } from '../context/MedicationContext';
import { triggerHaptic } from '../utils/haptics';

interface RefillForecastCardProps {
  onQuickRefill?: (servoId: number) => void;
}

export const RefillForecastCard: React.FC<RefillForecastCardProps> = ({ onQuickRefill }) => {
  const { chambers, schedules, refillChamber } = useMedication();

  const configuredChambers = chambers.filter((c) => c.medicationName.trim().length > 0);
  if (configuredChambers.length === 0) return null;

  return (
    <div className="ios-section">
      <div className="ios-section-header">Refill & Supply Forecast</div>
      <div className="ios-list">
        {configuredChambers.map((chamber) => {
          // Calculate daily consumption rate from active schedules for this chamber
          const matchingSchedules = schedules.filter(
            (s) => s.active && s.chamberId === chamber.servoId
          );
          const dosesPerDay = matchingSchedules.reduce((acc, s) => acc + s.times.length, 0);

          let daysLeft: number | null = null;
          let runOutDateStr = 'No routine set';

          if (dosesPerDay > 0) {
            daysLeft = Math.floor(chamber.currentCount / dosesPerDay);
            const runOutDate = new Date();
            runOutDate.setDate(runOutDate.getDate() + daysLeft);
            runOutDateStr = runOutDate.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
          }

          const isCritical = daysLeft !== null && daysLeft <= 2;
          const isLow = daysLeft !== null && daysLeft <= 5 && !isCritical;

          return (
            <div key={chamber.servoId} className="ios-row" style={{ alignItems: 'center' }}>
              <div className="ios-row-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="ios-row-label" style={{ fontWeight: 600 }}>
                    {chamber.medicationName}
                  </span>
                  {daysLeft !== null && daysLeft <= 2 && (
                    <span className="ios-badge red" style={{ fontSize: '10px' }}>
                      Refill Soon
                    </span>
                  )}
                  {daysLeft !== null && isLow && (
                    <span className="ios-badge orange" style={{ fontSize: '10px' }}>
                      Low Supply
                    </span>
                  )}
                </div>
                <div className="ios-row-sublabel">
                  {chamber.currentCount} pills left
                  {dosesPerDay > 0
                    ? ` · ${dosesPerDay} pill${dosesPerDay > 1 ? 's' : ''}/day · Est. run-out: ${runOutDateStr}`
                    : ' · Set routine to predict run-out date'}
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: isCritical
                        ? 'var(--ios-red)'
                        : isLow
                        ? 'var(--ios-orange, #ff9500)'
                        : 'var(--ios-label)',
                    }}
                  >
                    {daysLeft !== null ? `${daysLeft}d left` : '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ios-secondary)' }}>
                    Bottle {chamber.servoId}
                  </div>
                </div>

                <button
                  type="button"
                  className="ios-pill-btn primary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => {
                    triggerHaptic('success');
                    if (onQuickRefill) {
                      onQuickRefill(chamber.servoId);
                    } else {
                      refillChamber(chamber.servoId, chamber.maxCapacity);
                    }
                  }}
                  title="Full refill to max capacity"
                >
                  + Refill
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
