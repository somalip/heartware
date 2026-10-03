import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { useAlert } from '../context/AlertContext';
import { COMMUNITY_RESOURCES } from '../services/storageService';
import { IosSegmentedControl } from '../components/IosSegmentedControl';
import { triggerHaptic } from '../utils/haptics';

type FilterType = 'all' | 'free_clinic' | 'pharmacy_refill' | 'crisis_pantry';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'free_clinic', label: 'Clinics' },
  { value: 'pharmacy_refill', label: 'Pharmacies' },
  { value: 'crisis_pantry', label: 'Aid Banks' },
] as const;

export function Care({ goToAccount }: { goToAccount: () => void }) {
  const { user } = useAuth();
  const { chambers, dispenseNow } = useMedication();
  const { showToast } = useToast();
  const { showConfirm } = useAlert();
  const [filter, setFilter] = useState<FilterType>('all');

  const emergencyChamber = chambers.find((c) => c.servoId === 4);
  const contact = user?.emergencyContact;

  const handleDispenseEmergency = async () => {
    if (!emergencyChamber || emergencyChamber.currentCount === 0) {
      showToast('Emergency chamber is empty', 'error');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Dispense Emergency Dose?',
      message: `Actuate Slot 4 for immediate dispense of ${emergencyChamber.medicationName} (${emergencyChamber.pillStrength})?`,
      confirmText: 'Dispense Now',
      cancelText: 'Cancel',
      isDestructive: false,
    });

    if (confirmed) {
      triggerHaptic('heavy');
      const res = await dispenseNow(4, 'hardware_button');
      showToast(res.message, 'success');
    }
  };

  const filteredResources = filter === 'all'
    ? COMMUNITY_RESOURCES
    : COMMUNITY_RESOURCES.filter(r => r.type === filter);

  return (
    <>
      <div className="ios-large-title-block">
        <h1 className="ios-large-title">Care</h1>
        <p className="ios-subtitle">Emergency & Support</p>
      </div>

      {/* Emergency Immediate Action Group */}
      <div className="ios-section">
        <div className="ios-section-header">Emergency Response</div>
        <div className="ios-list">
          <div className="ios-row with-icon">
            <div className="ios-icon-box" style={{ backgroundColor: 'var(--ios-red)' }}>
              SOS
            </div>
            <div className="ios-row-content">
              <div className="ios-row-title">Emergency 911</div>
              <div className="ios-row-sublabel">Dispatch paramedics & critical response</div>
            </div>
            <a
              href="tel:911"
              className="ios-pill-btn red"
              onClick={() => triggerHaptic('heavy')}
            >
              Call 911
            </a>
          </div>

          <div className="ios-row with-icon">
            <div className="ios-icon-box" style={{ backgroundColor: 'var(--ios-orange)' }}>
              Rx
            </div>
            <div className="ios-row-content">
              <div className="ios-row-title">
                {emergencyChamber?.medicationName
                  ? `Dispense Slot 4 (${emergencyChamber.medicationName})`
                  : 'Slot 4 (Emergency PRN)'}
              </div>
              <div className="ios-row-sublabel">
                {emergencyChamber?.medicationName
                  ? `${emergencyChamber.currentCount} pills remaining in reservoir`
                  : 'Chamber not configured'}
              </div>
            </div>
            <button
              className="ios-pill-btn orange"
              onClick={handleDispenseEmergency}
              disabled={!emergencyChamber || !emergencyChamber.medicationName.trim() || emergencyChamber.currentCount === 0}
            >
              Dispense
            </button>
          </div>

          <div className="ios-row with-icon">
            <div className="ios-icon-box" style={{ backgroundColor: 'var(--ios-blue)' }}>
              📞
            </div>
            <div className="ios-row-content">
              <div className="ios-row-title">
                {contact?.name ? contact.name : 'Designated Caregiver'}
              </div>
              <div className="ios-row-sublabel">
                {contact?.phone ? contact.phone : 'No emergency contact set'}
              </div>
            </div>
            {contact?.phone ? (
              <a
                href={`tel:${contact.phone}`}
                className="ios-pill-btn green"
                onClick={() => triggerHaptic('medium')}
              >
                Call
              </a>
            ) : (
              <button
                className="ios-pill-btn blue"
                onClick={() => {
                  triggerHaptic('light');
                  goToAccount();
                }}
              >
                Set Contact
              </button>
            )}
          </div>
        </div>
        <div className="ios-section-footer">
          Chamber 4 is dedicated to emergency rapid-response medication (e.g. Aspirin, Nitroglycerin, Epi-aid).
        </div>
      </div>

      {/* Community Mutual Aid Directory */}
      <div className="ios-section">
        <div className="ios-section-header">Healthcare & Refill</div>

        {/* Animated Sliding Segmented Control */}
        <IosSegmentedControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(newVal) => setFilter(newVal)}
        />

        <div className="ios-list">
          {filteredResources.length === 0 ? (
            <div className="ios-row" style={{ color: 'var(--ios-secondary)' }}>
              No community healthcare resources listed.
            </div>
          ) : (
            filteredResources.map((r) => (
              <div key={r.id} className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-title">{r.title}</div>
                  <div className="ios-row-sublabel">{r.address} · {r.hours}</div>
                </div>
                <a
                  href={`tel:${r.phone}`}
                  className="ios-pill-btn blue"
                  onClick={() => triggerHaptic('light')}
                >
                  Call
                </a>
              </div>
            ))
          )}
        </div>
        <div className="ios-section-footer">
          Community resources ensure chronic healthcare is resilient during crisis and supply disruptions.
        </div>
      </div>
    </>
  );
}
