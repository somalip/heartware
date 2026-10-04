import { FormEvent, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useMedication } from "../context/MedicationContext";
import { useHardware } from "../context/HardwareContext";
import { useToast } from "../context/ToastContext";
import { useAlert } from "../context/AlertContext";
import { storageService } from "../services/storageService";
import { notificationService } from "../services/notificationService";
import { MedicationSafetyInfoModal } from "../components/MedicationSafetyInfoModal";
import { EmergencyRelayModal } from "../components/EmergencyRelayModal";
import { IosSpinner } from "../components/IosSpinner";
import { triggerHaptic } from "../utils/haptics";
import { firebaseSyncService, SyncStatus } from "../services/firebaseSyncService";
import { firebaseConfig } from "../services/firebase";

export function Account() {
  const { user, updateProfile, logout, isFirebaseConnected } = useAuth();
  const { chambers, updateChamberConfig, syncWithCloudNow } = useMedication();
  const { state: hwState, testCalibrateServo, syncServoConfig } = useHardware();
  const { showToast } = useToast();
  const { showConfirm } = useAlert();

  const [name, setName] = useState(user?.name ?? "");
  const [contactName, setContactName] = useState(user?.emergencyContact.name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.emergencyContact.phone ?? "");
  const [notifPerm, setNotifPerm] = useState(notificationService.getPermission());
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<SyncStatus>("idle");
  const [cloudDetail, setCloudDetail] = useState<string | undefined>();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const isStandalone = notificationService.isStandalone();

  useEffect(() => {
    return firebaseSyncService.subscribeStatus((status, detail) => {
      setCloudStatus(status);
      setCloudDetail(detail);
    });
  }, []);

  // Servo Calibration & Speed Settings
  const [selectedServoId, setSelectedServoId] = useState<number>(chambers[0]?.servoId ?? 1);
  const activeChamber = chambers.find((c) => c.servoId === selectedServoId) || chambers[0];
  const [servoAngle, setServoAngle] = useState<number>(activeChamber?.servoAngleDispense ?? 90);
  const [servoSpeed, setServoSpeed] = useState<number>(activeChamber?.servoSpeed ?? 10);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Sync state if active chamber changes
  useEffect(() => {
    if (activeChamber) {
      setServoAngle(activeChamber.servoAngleDispense ?? 90);
      setServoSpeed(activeChamber.servoSpeed ?? 10);
      setTestStatus(null);
    }
  }, [selectedServoId, activeChamber?.servoAngleDispense, activeChamber?.servoSpeed]);

  if (!user) return null;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    triggerHaptic("success");
    updateProfile({
      name: name.trim(),
      emergencyContact: { name: contactName.trim(), phone: contactPhone.trim() },
    });
    showToast("Profile updated", "success");
  };

  const handleSaveServoSettings = () => {
    if (!activeChamber) return;
    triggerHaptic("success");
    updateChamberConfig(activeChamber.servoId, {
      servoAngleDispense: servoAngle,
      servoSpeed: servoSpeed,
    });
    syncServoConfig(activeChamber.servoId, servoAngle, servoSpeed);
    showToast(`Servo #${activeChamber.servoId} updated: ${servoAngle}° @ ${servoSpeed}ms/step`, "success");
  };

  const handleTestServo = async () => {
    if (!activeChamber || isTesting) return;
    triggerHaptic("medium");
    setIsTesting(true);
    setTestStatus("Sweeping servo motor...");
    try {
      const msg = await testCalibrateServo(activeChamber.servoId, servoAngle, servoSpeed);
      setTestStatus(msg);
      triggerHaptic("success");
      showToast(`Tested: ${servoAngle}° @ ${servoSpeed}ms/step`, "info");
    } catch (err: any) {
      setTestStatus("Calibration test failed");
      showToast(err?.message || "Servo test failed", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const getSpeedMeta = (speedMs: number) => {
    if (speedMs <= 4) {
      return { label: "Turbo", badgeClass: "blue", desc: "Maximum velocity dispense cycle" };
    }
    if (speedMs <= 8) {
      return { label: "Fast", badgeClass: "green", desc: "Rapid, crisp servo actuation" };
    }
    if (speedMs <= 15) {
      return { label: "Balanced", badgeClass: "green", desc: "Standard smooth, reliable rotation" };
    }
    return { label: "Gentle", badgeClass: "orange", desc: "Slow & quiet, protects brittle tablets" };
  };

  const speedMeta = getSpeedMeta(servoSpeed);
  // Speed percentage: 10% (30ms) to 100% (3ms)
  const speedPercentage = Math.round(100 - ((servoSpeed - 3) / 27) * 90);

  const handleResetDevice = async () => {
    const confirmed = await showConfirm({
      title: "Reset Dispenser?",
      message: "Reverts chambers, servo calibration angles, and schedules back to factory calibration presets. Accounts remain intact.",
      confirmText: "Reset Configuration",
      cancelText: "Cancel",
      isDestructive: true,
    });

    if (confirmed) {
      storageService.resetDevice();
      showToast("Device reset to factory defaults", "warning");
      setTimeout(() => location.reload(), 600);
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm({
      title: "Sign Out?",
      message: "Are you sure you want to sign out of Heartware on this device?",
      confirmText: "Sign Out",
      cancelText: "Cancel",
      isDestructive: true,
    });

    if (confirmed) {
      logout();
    }
  };

  const handleEnableNotifications = async () => {
    triggerHaptic("medium");
    const res = await notificationService.requestPermission();
    setNotifPerm(res);
    if (res === "granted") {
      showToast("Notifications enabled!", "success");
      await notificationService.sendTestNotification();
    } else if (res === "denied") {
      showToast("Notifications blocked in browser/system settings", "error");
    }
  };

  return (
    <>
      <div className="ios-large-title-block">
        <h1 className="ios-large-title">Settings</h1>
      </div>

      {/* Responsive Settings Grid: 2 Columns on Desktop, Single Column on Mobile */}
      <div className="settings-desktop-grid">
        {/* Profile & Emergency Contact Column */}
        <div>
          <form onSubmit={handleSave}>
            {/* Account Info Inset Group */}
            <div className="ios-section">
              <div className="ios-section-header">Account Information</div>
              <div className="ios-list">
                <div className="ios-row">
                  <div className="ios-detail-label">Full Name</div>
                  <input
                    className="ios-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Required"
                    required
                  />
                </div>
                <div className="ios-row">
                  <div className="ios-detail-label">Email</div>
                  <div className="ios-row-value ios-row-value-inline">
                    {user.email}
                  </div>
                </div>
                <div className="ios-row">
                  <div className="ios-detail-label">Role</div>
                  <div className="ios-row-value ios-row-value-inline" style={{ textTransform: "capitalize" }}>
                    {user.role}
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Sync Inset Group */}
            <div className="ios-section">
              <div className="ios-section-header">Firebase Cloud Synchronization</div>
              <div className="ios-list">
                <div className="ios-row">
                  <div className="ios-row-content">
                    <div className="ios-row-title">Firestore Database</div>
                    <div className="ios-row-sublabel">
                      Project: {firebaseConfig.projectId}
                    </div>
                  </div>
                  <span className={`ios-badge ${isFirebaseConnected ? "green" : "orange"}`}>
                    {isFirebaseConnected ? "Connected" : "Offline Mode"}
                  </span>
                </div>
                <div className="ios-row">
                  <div className="ios-row-content">
                    <div className="ios-row-title">Cloud State</div>
                    <div className="ios-row-sublabel">
                      {cloudDetail || (cloudStatus === "synced" ? "All records up to date" : "Idle")}
                    </div>
                  </div>
                  <span className={`ios-badge ${cloudStatus === "synced" ? "green" : cloudStatus === "syncing" ? "blue" : cloudStatus === "error" ? "red" : ""}`}>
                    {cloudStatus.toUpperCase()}
                  </span>
                </div>
                <div
                  className="ios-row interactive"
                  onClick={async () => {
                    if (isManualSyncing) return;
                    triggerHaptic("medium");
                    setIsManualSyncing(true);
                    showToast("Syncing all schedules, bottles & logs to Firebase...", "info");
                    try {
                      await syncWithCloudNow();
                      triggerHaptic("success");
                      showToast("Cloud synchronization complete!", "success");
                    } catch (e: any) {
                      triggerHaptic("error");
                      showToast(e.message || "Sync failed", "error");
                    } finally {
                      setIsManualSyncing(false);
                    }
                  }}
                >
                  <div className="ios-row-content">
                    <div className="ios-row-title" style={{ color: "var(--ios-blue)" }}>
                      {isManualSyncing ? "Synchronizing..." : "Sync Now to Cloud"}
                    </div>
                    <div className="ios-row-sublabel">
                      Reconcile all local dispenser data and history with Firestore
                    </div>
                  </div>
                  {isManualSyncing ? <IosSpinner size={18} /> : <div className="ios-chevron" style={{ color: "var(--ios-tertiary)", fontSize: "20px" }}>›</div>}
                </div>
              </div>
            </div>

            {/* Emergency Relay Inset Group */}
            <div className="ios-section">
              <div className="ios-section-header">Emergency Contact</div>
              <div className="ios-list">
                <div className="ios-row">
                  <div className="ios-detail-label">Contact Name</div>
                  <input
                    className="ios-input"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="ios-row">
                  <div className="ios-detail-label">Phone Number</div>
                  <input
                    type="tel"
                    className="ios-input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div
                  className="ios-row interactive"
                  onClick={() => {
                    triggerHaptic("medium");
                    setShowEmergencyModal(true);
                  }}
                >
                  <div className="ios-row-content">
                    <div className="ios-row-title" style={{ color: "var(--ios-red)" }}>
                      Test Emergency SOS & SMS Relay
                    </div>
                    <div className="ios-row-sublabel">
                      Preview caregiver call & automated status alert
                    </div>
                  </div>
                  <div className="ios-chevron" style={{ color: "var(--ios-tertiary)", fontSize: "20px" }}>›</div>
                </div>
              </div>
            </div>

            <div style={{ padding: "0 4px", marginBottom: "24px" }}>
              <button type="submit" className="ios-btn-primary">
                Save Profile
              </button>
            </div>
          </form>
        </div>

        {/* System, Notifications & Device Column */}
        <div>
          {/* Notifications Section */}
          <div className="ios-section">
            <div className="ios-section-header">Notifications</div>
            <div className="ios-list">
              <div className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-title">Dosing Reminders</div>
                  <div className="ios-row-sublabel">
                    {notifPerm === "granted"
                      ? "Active · Lock screen & watch alerts enabled"
                      : notifPerm === "denied"
                      ? "Blocked · Enable notifications in browser/system settings"
                      : notifPerm === "unsupported"
                      ? "Notifications not supported in this browser"
                      : "Receive scheduled medication alerts"}
                  </div>
                </div>
                {notifPerm === "granted" ? (
                  <span className="ios-badge green">Active</span>
                ) : notifPerm === "denied" ? (
                  <span className="ios-badge red">Blocked</span>
                ) : notifPerm === "unsupported" ? (
                  <span className="ios-badge">Unavailable</span>
                ) : (
                  <button
                    type="button"
                    className="ios-pill-btn primary"
                    onClick={handleEnableNotifications}
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>
            <div className="ios-section-footer">
              {isStandalone
                ? "Active as Home Screen Web App. Dosing alerts appear directly on your Lock Screen and Apple Watch."
                : 'For notifications on iOS, tap the Share icon and select "Add to Home Screen". Once added, notifications can alert your Lock Screen.'}
            </div>
          </div>

          {/* Safety Database Section */}
          <div className="ios-section">
            <div className="ios-section-header">Clinical Standards & Safety</div>
            <div className="ios-list">
              <div
                className="ios-row interactive"
                onClick={() => {
                  triggerHaptic("light");
                  setShowSafetyModal(true);
                }}
              >
                <div className="ios-row-content">
                  <div className="ios-row-title">Dosage limits</div>
                  <div className="ios-row-sublabel">
                    How daily limits are calculated
                  </div>
                </div>
                <div className="ios-chevron" style={{ color: "var(--ios-tertiary)", fontSize: "20px" }}>›</div>
              </div>
            </div>
          </div>

          {/* Servo & Motor Calibration Section */}
          <div className="ios-section">
            <div className="ios-section-header">Servo & Motor Calibration</div>
            <div className="ios-list">
              {/* Bottle Selection */}
              {chambers.length > 1 ? (
                <div className="ios-row">
                  <div className="ios-detail-label">Active Bottle</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {chambers.map((c) => (
                      <button
                        key={c.servoId}
                        type="button"
                        className={`ios-pill-btn ${c.servoId === selectedServoId ? "primary" : ""}`}
                        onClick={() => {
                          triggerHaptic("selection");
                          setSelectedServoId(c.servoId);
                        }}
                      >
                        Bottle {c.servoId}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ios-row">
                  <div className="ios-row-content">
                    <div className="ios-row-title">Bottle #{activeChamber?.servoId ?? 1}</div>
                    <div className="ios-row-sublabel">
                      {activeChamber?.medicationName ? activeChamber.medicationName : "Primary Dispenser Slot"}
                    </div>
                  </div>
                  <span className={`ios-badge ${hwState.connected ? "green" : "orange"}`}>
                    {hwState.connected ? (hwState.connectionType === "ble" ? "BLE Linked" : "Simulated") : "Hardware Offline"}
                  </span>
                </div>
              )}

              {/* Dispense Angle Slider */}
              <div className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-label">Dispense Angle</div>
                  <div className="ios-row-sublabel">Rotation sweep from 0° rest position</div>
                </div>
                <div className="ios-row-value-bold" style={{ fontSize: "17px", color: "var(--ios-blue)" }}>
                  {servoAngle}°
                </div>
              </div>
              <div className="ios-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="1"
                  value={servoAngle}
                  onChange={(e) => {
                    setServoAngle(Number(e.target.value));
                    setTestStatus(null);
                  }}
                  className="ios-range-input"
                />
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { label: "60° Mini", angle: 60 },
                    { label: "90° Standard", angle: 90 },
                    { label: "120° Large", angle: 120 },
                    { label: "147° Wide", angle: 147 },
                  ].map((preset) => (
                    <button
                      key={preset.angle}
                      type="button"
                      className={`ios-pill-btn ${servoAngle === preset.angle ? "primary" : ""}`}
                      style={{ fontSize: "12px", padding: "4px 10px" }}
                      onClick={() => {
                        triggerHaptic("selection");
                        setServoAngle(preset.angle);
                        setTestStatus(null);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Servo Speed Slider */}
              <div className="ios-row">
                <div className="ios-row-content">
                  <div className="ios-row-label">Movement Speed</div>
                  <div className="ios-row-sublabel">{speedMeta.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`ios-badge ${speedMeta.badgeClass}`}>
                    {speedMeta.label}
                  </span>
                  <div className="ios-row-value-bold" style={{ fontSize: "15px" }}>
                    {servoSpeed}ms/step
                  </div>
                </div>
              </div>
              <div className="ios-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={speedPercentage}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    const calcMs = Math.max(2, Math.min(30, Math.round(30 - ((pct - 10) / 90) * 27)));
                    setServoSpeed(calcMs);
                    setTestStatus(null);
                  }}
                  className="ios-range-input"
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ios-secondary)" }}>
                  <span>🐢 Slower (Gentle)</span>
                  <span>⚡ Normal</span>
                  <span>🚀 Faster (Quick)</span>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { label: "🐢 Gentle (24ms)", speed: 24 },
                    { label: "⚡ Balanced (12ms)", speed: 12 },
                    { label: "🚀 Fast (6ms)", speed: 6 },
                    { label: "🏎️ Turbo (3ms)", speed: 3 },
                  ].map((preset) => (
                    <button
                      key={preset.speed}
                      type="button"
                      className={`ios-pill-btn ${servoSpeed === preset.speed ? "primary" : ""}`}
                      style={{ fontSize: "12px", padding: "4px 10px" }}
                      onClick={() => {
                        triggerHaptic("selection");
                        setServoSpeed(preset.speed);
                        setTestStatus(null);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Test Status feedback if present */}
              {testStatus && (
                <div className="ios-row" style={{ background: "rgba(52, 199, 89, 0.08)" }}>
                  <div className="ios-row-content">
                    <div className="ios-row-sublabel" style={{ color: "var(--ios-green)", fontWeight: 600 }}>
                      {testStatus}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions: Test Sweep & Save */}
              <div className="ios-row interactive" onClick={handleTestServo}>
                <button
                  type="button"
                  className="ios-row-action"
                  disabled={isTesting}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  {isTesting ? (
                    <>
                      <IosSpinner size={16} />
                      Testing Servo Motion...
                    </>
                  ) : (
                    `Test Servo Motion (${servoAngle}° @ ${servoSpeed}ms)`
                  )}
                </button>
              </div>

              <div className="ios-row interactive" onClick={handleSaveServoSettings}>
                <button
                  type="button"
                  className="ios-row-action center"
                  style={{ color: "var(--ios-blue)", fontWeight: 600 }}
                >
                  Save Servo Settings
                </button>
              </div>
            </div>
            <div className="ios-section-footer">
              Angle controls rotation sweep from rest to drop a pill (default 90°–147°). Speed controls the step pulse interval (faster speeds dispense quicker; slower speeds prevent pill bouncing).
            </div>
          </div>

          {/* Device Management Section */}
          <div className="ios-section">
            <div className="ios-section-header">Device</div>
            <div className="ios-list">
              <div className="ios-row interactive" onClick={handleResetDevice}>
                <button type="button" className="ios-row-action danger">
                  Reset Configuration
                </button>
              </div>
            </div>
          </div>

          {/* Session Management */}
          <div className="ios-section">
            <div className="ios-list">
              <div className="ios-row interactive" onClick={handleLogout}>
                <button type="button" className="ios-row-action danger center">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSafetyModal && (
        <MedicationSafetyInfoModal onClose={() => setShowSafetyModal(false)} />
      )}

      {showEmergencyModal && (
        <EmergencyRelayModal onClose={() => setShowEmergencyModal(false)} />
      )}
    </>
  );
}
