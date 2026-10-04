import React, { useState } from 'react';
import { IosSheet } from './IosSheet';
import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { searchMedications, findBestMatch } from '../data/medicationDatabase';
import { MedicationReference } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface ManualLogModalProps {
  onClose: () => void;
}

export function ManualLogModal({ onClose }: ManualLogModalProps) {
  const { chambers, logManualIntake } = useMedication();
  const { showToast } = useToast();

  const [selectedChamberId, setSelectedChamberId] = useState<number>(0);
  const [medicationName, setMedicationName] = useState('');
  const [pillStrength, setPillStrength] = useState('');
  const [pillsCount, setPillsCount] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Time logging: default to now (formatted for datetime-local input)
  const getLocalDatetime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const [dateTime, setDateTime] = useState(getLocalDatetime());

  // Suggestions
  const suggestions = medicationName.trim().length > 1 ? searchMedications(medicationName).slice(0, 5) : [];

  const handleSelectMedication = (med: MedicationReference) => {
    setMedicationName(med.brandName);
    setPillStrength(med.defaultStrength);
    setShowSuggestions(false);
    triggerHaptic('selection');
  };

  const handleChamberSelect = (chamberId: number) => {
    setSelectedChamberId(chamberId);
    if (chamberId > 0) {
      const ch = chambers.find((c) => c.servoId === chamberId);
      if (ch && ch.medicationName) {
        setMedicationName(ch.medicationName);
        setPillStrength(ch.pillStrength || '');
      }
    }
  };

  const matched = medicationName.trim() ? findBestMatch(medicationName) : null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!medicationName.trim()) {
      showToast('Please specify a medication name', 'error');
      return;
    }

    triggerHaptic('success');
    const chamberIdValue = (selectedChamberId >= 1 && selectedChamberId <= 4 ? selectedChamberId : 0) as 1 | 2 | 3 | 4 | 0;

    logManualIntake({
      medicationName: medicationName.trim(),
      pillStrength: pillStrength.trim() || undefined,
      pillsDispensed: pillsCount,
      timestamp: new Date(dateTime).toISOString(),
      notes: notes.trim() || undefined,
      chamberId: chamberIdValue,
    });

    showToast(`Logged intake: ${pillsCount}x ${medicationName.trim()}`, 'success');
    onClose();
  };

  return (
    <IosSheet
      title="Log Medication"
      leftActionText="Cancel"
      onLeftAction={onClose}
      rightActionText="Log"
      onRightAction={handleSubmit}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ paddingBottom: '30px' }}>
        {/* Source Selector */}
        <div className="ios-section">
          <div className="ios-section-header">Source</div>
          <div className="ios-list">
            <div className="ios-row">
              <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Log Source</div>
              <select
                className="ios-input"
                value={selectedChamberId}
                onChange={(e) => handleChamberSelect(Number(e.target.value))}
              >
                <option value={0}>External / Other Medication</option>
                {chambers
                  .filter((c) => c.medicationName && c.medicationName.trim().length > 0)
                  .map((c) => (
                    <option key={c.servoId} value={c.servoId}>
                      Bottle {c.servoId}: {c.medicationName} ({c.currentCount} left)
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Medication Details */}
        <div className="ios-section">
          <div className="ios-section-header">Medication Details</div>
          <div className="ios-list">
            <div className="ios-row" style={{ position: 'relative' }}>
              <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Name</div>
              <input
                className="ios-input"
                value={medicationName}
                onChange={(e) => {
                  setMedicationName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. Advil, Lisinopril, Metformin"
                required
              />
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
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
              <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Strength</div>
              <input
                className="ios-input"
                value={pillStrength}
                onChange={(e) => setPillStrength(e.target.value)}
                placeholder="e.g. 200mg, 500mg (optional)"
              />
            </div>

            <div className="ios-row">
              <div className="ios-row-content">
                <div className="ios-row-label">Quantity Taken</div>
                <div className="ios-row-sublabel">Units / Pills</div>
              </div>
              <div className="ios-stepper">
                <button
                  type="button"
                  className="ios-stepper-btn"
                  onClick={() => {
                    triggerHaptic('light');
                    setPillsCount(Math.max(1, pillsCount - 1));
                  }}
                >
                  −
                </button>
                <div className="ios-stepper-divider" />
                <span className="ios-stepper-value">{pillsCount}</span>
                <div className="ios-stepper-divider" />
                <button
                  type="button"
                  className="ios-stepper-btn"
                  onClick={() => {
                    triggerHaptic('light');
                    setPillsCount(Math.min(10, pillsCount + 1));
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Date and Time */}
        <div className="ios-section">
          <div className="ios-section-header">Intake Time</div>
          <div className="ios-list">
            <div className="ios-row">
              <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Timestamp</div>
              <input
                type="datetime-local"
                className="ios-input"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="ios-section">
          <div className="ios-section-header">Clinical Notes (Optional)</div>
          <div className="ios-list">
            <div className="ios-row">
              <textarea
                className="ios-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Taken with food, mild headache, post-workout"
                style={{ resize: 'none', padding: '6px 0' }}
              />
            </div>
          </div>
        </div>

        {/* Active Ingredients Clinical Summary */}
        {matched && matched.activeIngredients && matched.activeIngredients.length > 0 && (
          <div className="ios-section">
            <div className="ios-section-header">Safety & Active Ingredients</div>
            <div className="ios-list">
              {matched.activeIngredients.map((ing, idx) => (
                <div key={idx} className="ios-row">
                  <div className="ios-row-content">
                    <div className="ios-row-label">{ing.name}</div>
                    <div className="ios-row-sublabel">
                      {ing.amountMg * pillsCount} mg total ({ing.amountMg} mg × {pillsCount})
                    </div>
                  </div>
                  <span className="ios-badge green">Monitored</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </IosSheet>
  );
}
