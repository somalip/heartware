import React, { useState } from 'react';
import { DispenseSafetyEvaluation } from '../types';
import { MedicationSafetyInfoModal } from './MedicationSafetyInfoModal';
import { triggerHaptic } from '../utils/haptics';
import { AlertTriangleIcon, InfoIcon } from './Icons';

interface Props {
  evaluation: DispenseSafetyEvaluation;
  targetMedicationName: string;
  targetSlotId: number;
  onCancel: () => void;
  onConfirmOverride: () => void;
}

export const CrossIntakeAlertModal: React.FC<Props> = ({
  evaluation,
  targetMedicationName,
  targetSlotId,
  onCancel,
  onConfirmOverride,
}) => {
  const isHardBlocked = evaluation.hardBlocked;
  const [showSafetyInfo, setShowSafetyInfo] = useState(false);

  return (
    <>
      <div className="ios-sheet-backdrop" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ios-alert-dialog" role="dialog" aria-modal="true">
          <div className="ios-alert-icon-container">
          <AlertTriangleIcon size={32} color="var(--ios-orange)" />
        </div>

        <h3 className="ios-alert-title">
          {isHardBlocked
            ? `Dispense Locked: Overdose Risk (${targetMedicationName || 'Slot ' + targetSlotId})`
            : `Dose Safety Warning: ${targetMedicationName || 'Slot ' + targetSlotId}`}
        </h3>

        <div className="ios-alert-body">
          <p className="ios-alert-message-lead">
            {evaluation.blockReason || evaluation.warnings[0] || 'Safety limits exceeded.'}
          </p>

          {evaluation.exceededIngredient && (
            <div className="ios-alert-breakdown-card">
              <div className="ios-breakdown-row">
                <span>Active Ingredient:</span>
                <strong>{evaluation.exceededIngredient.name}</strong>
              </div>
              <div className="ios-breakdown-row">
                <span>Current 24h Intake:</span>
                <span>{evaluation.exceededIngredient.currentMg} mg</span>
              </div>
              <div className="ios-breakdown-row highlight-risk">
                <span>Intake After This Dose:</span>
                <strong>{evaluation.exceededIngredient.wouldBeMg} mg</strong>
              </div>
              <div className="ios-breakdown-row">
                <span>Safe Daily Cap:</span>
                <span>{evaluation.exceededIngredient.maxMg} mg</span>
              </div>
            </div>
          )}

          {evaluation.recentDoseIntervalViolation && (
            <div className="ios-alert-interval-warning">
              Minimum safe interval is {evaluation.recentDoseIntervalViolation.minIntervalHours} hours. You took {evaluation.recentDoseIntervalViolation.medicationName} only {evaluation.recentDoseIntervalViolation.lastTakenMinutesAgo} minutes ago.
            </div>
          )}

          <p className="ios-alert-subtext">
            Taking multiple medications with the same active ingredient (such as DayQuil and Tylenol) is a leading cause of accidental toxicity.
          </p>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowSafetyInfo(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              color: 'var(--ios-label)',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'block',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            <InfoIcon size={14} color="var(--ios-label)" /> How is this limit calculated? View public clinical standards →
          </button>
        </div>

        <div className="ios-alert-actions-vertical">
          <button
            type="button"
            className="ios-alert-btn primary"
            onClick={() => {
              triggerHaptic('light');
              onCancel();
            }}
          >
            Cancel Dispense (Recommended)
          </button>

          <button
            type="button"
            className="ios-alert-btn destructive-text"
            onClick={() => {
              triggerHaptic('warning');
              onConfirmOverride();
            }}
          >
            Emergency Override & Dispense Slot {targetSlotId}
          </button>
        </div>
      </div>
    </div>

    {showSafetyInfo && (
      <MedicationSafetyInfoModal onClose={() => setShowSafetyInfo(false)} />
    )}
  </>
  );
};
