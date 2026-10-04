import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useMedication } from '../context/MedicationContext';
import { useToast } from '../context/ToastContext';
import { triggerHaptic } from '../utils/haptics';

interface EmergencyRelayModalProps {
  onClose: () => void;
}

export const EmergencyRelayModal: React.FC<EmergencyRelayModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { logs, chambers } = useMedication();
  const { showToast } = useToast();

  const contact = user?.emergencyContact;
  const hasContact = Boolean(contact?.phone?.trim());

  // Gather latest medication activity for quick emergency context
  const latestLog = logs[0];
  const activeMedsList = chambers
    .filter((c) => c.medicationName.trim().length > 0)
    .map((c) => `${c.medicationName}${c.pillStrength ? ` (${c.pillStrength})` : ''}`)
    .join(', ');

  const emergencyMessage = `URGENT - Heartware Medical Alert:
Patient: ${user?.name || 'Patient'}
${latestLog ? `Last dose logged: ${latestLog.medicationName} (${latestLog.pillsDispensed || 1} pill) at ${new Date(latestLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No recent doses logged today.'}
Active bottle medications: ${activeMedsList || 'None configured'}

I need immediate assistance or a check-in.`;

  const encodedSms = encodeURIComponent(emergencyMessage);
  const smsHref = contact?.phone ? `sms:${contact.phone}?body=${encodedSms}` : `sms:?body=${encodedSms}`;
  const callHref = contact?.phone ? `tel:${contact.phone.replace(/[^0-9+]/g, '')}` : '#';

  const handleCallCaregiver = () => {
    if (!hasContact) {
      showToast('No emergency phone configured. Please add one in Settings.', 'error');
      return;
    }
    triggerHaptic('heavy');
    window.location.href = callHref;
  };

  const handleSendSms = () => {
    triggerHaptic('medium');
    window.location.href = smsHref;
  };

  return (
    <div className="ios-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="ios-modal-card"
        style={{ maxWidth: '440px', padding: '24px 20px', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 59, 48, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--ios-red)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ios-label)' }}>
          Emergency & Caregiver Relay
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--ios-secondary)', margin: '0 0 20px', lineHeight: 1.4 }}>
          Quickly notify your emergency contact or dispatch services with your current medication record.
        </p>

        {/* Contact info pill */}
        <div
          style={{
            backgroundColor: 'var(--ios-fill)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--ios-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
            Designated Contact
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '2px', color: 'var(--ios-label)' }}>
            {contact?.name || 'No contact name specified'}
          </div>
          <div style={{ fontSize: '13px', color: hasContact ? 'var(--ios-label)' : 'var(--ios-red)', marginTop: '2px' }}>
            {contact?.phone || 'No phone number saved in Settings'}
          </div>
        </div>

        {/* Direct Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={handleCallCaregiver}
            disabled={!hasContact}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--ios-green)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '16px',
              cursor: hasContact ? 'pointer' : 'not-allowed',
              opacity: hasContact ? 1 : 0.5,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Call {contact?.name ? contact.name : 'Caregiver'}
          </button>

          <button
            type="button"
            onClick={handleSendSms}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--ios-label)',
              color: 'var(--ios-bg)',
              border: 'none',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Send Pre-Filled SMS Alert
          </button>

          <a
            href="tel:911"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 59, 48, 0.1)',
              color: 'var(--ios-red)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '15px',
              border: '1px solid rgba(255, 59, 48, 0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Dial 911 (Emergency Dispatch)
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--ios-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          Cancel & Close
        </button>
      </div>
    </div>
  );
};
