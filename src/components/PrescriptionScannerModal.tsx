import React, { useState, useRef, useEffect } from 'react';
import { ChamberConfig } from '../types';
import { IosSheet } from './IosSheet';
import { IosSpinner } from './IosSpinner';
import {
  prescriptionOcrService,
  ParsedPrescription,
} from '../services/prescriptionOcrService';
import { medicationSafetyService } from '../services/medicationSafetyService';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  chambers: ChamberConfig[];
  initialSlotId?: 1 | 2 | 3 | 4;
  onApply: (data: {
    slotId: 1 | 2 | 3 | 4;
    medicationName: string;
    pillStrength: string;
    activeIngredients: ParsedPrescription['activeIngredients'];
    maxDailyDoses: number;
    dosage: string;
    times: string[];
    instructions: string;
    prescribedBy: string;
  }) => void;
  onClose: () => void;
}

export const PrescriptionScannerModal: React.FC<Props> = ({
  chambers,
  initialSlotId = 1,
  onApply,
  onClose,
}) => {
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [parsedRx, setParsedRx] = useState<ParsedPrescription | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | 3 | 4>(initialSlotId);

  // Form states for user adjustments
  const [editName, setEditName] = useState('');
  const [editStrength, setEditStrength] = useState('');
  const [editMaxDoses, setEditMaxDoses] = useState(4);
  const [editInstructions, setEditInstructions] = useState('');
  const [editTimes, setEditTimes] = useState<string[]>(['08:00']);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraError('Unable to access device camera. You can upload a photo or type label text.');
    }
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    triggerHaptic('medium');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewImage(dataUrl);
      stopCamera();

      setIsProcessing(true);
      // Try native optical text recognition on the captured frame
      const detectedText = await prescriptionOcrService.detectTextFromImage(canvas);
      setIsProcessing(false);

      if (detectedText.trim()) {
        setManualText(detectedText);
        processPrescriptionText(detectedText);
      } else {
        // If optical text detection not available on this device, prompt user to enter label text
        triggerHaptic('light');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('light');
    setIsProcessing(true);
    try {
      const dataUrl = await prescriptionOcrService.readImageFile(file);
      setPreviewImage(dataUrl);

      // Create an offscreen image to run optical text detection
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const detectedText = await prescriptionOcrService.detectTextFromImage(img);
      setIsProcessing(false);

      if (detectedText.trim()) {
        setManualText(detectedText);
        processPrescriptionText(detectedText);
      }
    } catch {
      setIsProcessing(false);
    }
  };

  const handleManualTextChange = (text: string) => {
    setManualText(text);
    if (text.trim().length > 3) {
      processPrescriptionText(text);
    }
  };

  const processPrescriptionText = (text: string) => {
    const parsed = prescriptionOcrService.parsePrescriptionText(text);
    setParsedRx(parsed);
    setEditName(parsed.medicationName);
    setEditStrength(parsed.pillStrength);
    setEditMaxDoses(parsed.maxDailyDoses);
    setEditInstructions(parsed.instructions);
    setEditTimes(parsed.times);
    triggerHaptic('success');
  };

  // Cross-intake clash check if applying to selectedSlot
  const simulatedChambers = chambers.map((c) =>
    c.servoId === selectedSlot
      ? {
          ...c,
          medicationName: editName,
          pillStrength: editStrength,
          activeIngredients: parsedRx?.activeIngredients || [],
          maxDailyDoses: editMaxDoses,
        }
      : c
  );
  const potentialConflicts = medicationSafetyService.checkChamberConflicts(simulatedChambers);

  const handleApply = () => {
    if (!editName.trim()) return;
    triggerHaptic('success');
    onApply({
      slotId: selectedSlot,
      medicationName: editName,
      pillStrength: editStrength,
      activeIngredients: parsedRx?.activeIngredients || [],
      maxDailyDoses: editMaxDoses,
      dosage: parsedRx?.dosage || '1 unit',
      times: editTimes,
      instructions: editInstructions,
      prescribedBy: parsedRx?.prescribedBy || '',
    });
    onClose();
  };

  return (
    <IosSheet
      title="Scan Prescription Label"
      leftActionText="Cancel"
      onLeftAction={() => {
        stopCamera();
        onClose();
      }}
      rightActionText={parsedRx || editName.trim() ? 'Apply' : undefined}
      onRightAction={parsedRx || editName.trim() ? handleApply : undefined}
      onClose={() => {
        stopCamera();
        onClose();
      }}
    >
      {/* Mode Segmented Controls */}
      <div className="ios-scan-mode-tabs">
        <button
          type="button"
          className={`ios-scan-tab-btn ${scanMode === 'camera' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('selection');
            setScanMode('camera');
            startCamera();
          }}
        >
          Camera
        </button>
        <button
          type="button"
          className={`ios-scan-tab-btn ${scanMode === 'upload' ? 'active' : ''}`}
          onClick={() => {
            triggerHaptic('selection');
            stopCamera();
            setScanMode('upload');
            fileInputRef.current?.click();
          }}
        >
          Upload Photo
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Mode 1: Camera Viewfinder */}
      {scanMode === 'camera' && !previewImage && (
        <div className="ios-camera-container">
          {cameraError ? (
            <div className="ios-camera-error">
              <p>{cameraError}</p>
              <button
                type="button"
                className="ios-row-action"
                style={{ marginTop: '10px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Photo from Device
              </button>
            </div>
          ) : (
            <div className="ios-camera-viewfinder">
              <video ref={videoRef} className="ios-camera-video" playsInline autoPlay muted />
              <div className="ios-viewfinder-overlay">
                <div className="ios-viewfinder-box">
                  <div className="ios-viewfinder-corner tl" />
                  <div className="ios-viewfinder-corner tr" />
                  <div className="ios-viewfinder-corner bl" />
                  <div className="ios-viewfinder-corner br" />
                  <div className="ios-viewfinder-hint">Align Bottle Label Inside Frame</div>
                </div>
              </div>
              <button
                type="button"
                className="ios-camera-shutter-btn"
                onClick={handleCapturePhoto}
                title="Capture Prescription"
              >
                <div className="ios-shutter-inner" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Upload Photo Empty State */}
      {scanMode === 'upload' && !previewImage && (
        <div className="ios-upload-empty-state" onClick={() => fileInputRef.current?.click()}>
          <div className="ios-upload-icon">📷</div>
          <div className="ios-upload-title">Choose Photo or Bottle Picture</div>
          <div className="ios-upload-subtitle">Tap to select a prescription bottle image from your device</div>
          <button type="button" className="ios-nav-action" style={{ marginTop: '12px' }}>
            Select Image
          </button>
        </div>
      )}

      {/* Photo Preview when taken / uploaded */}
      {previewImage && (
        <div className="ios-preview-thumbnail-wrap">
          <img src={previewImage} alt="Label Snapshot" className="ios-preview-thumbnail" />
          <button
            type="button"
            className="ios-badge"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              setPreviewImage(null);
              setParsedRx(null);
              setManualText('');
              setEditName('');
              if (scanMode === 'camera') startCamera();
            }}
          >
            Retake
          </button>
        </div>
      )}

      {/* Processing Spinner */}
      {isProcessing && (
        <div className="ios-processing-banner">
          <IosSpinner size={20} color="var(--ios-blue)" />
          <span>Reading bottle label text…</span>
        </div>
      )}

      {/* Label Text Input / Review */}
      <div className="ios-section">
        <div className="ios-section-header">Prescription Label Text</div>
        <div className="ios-list">
          <div className="ios-row">
            <textarea
              className="ios-input"
              rows={3}
              value={manualText}
              onChange={(e) => handleManualTextChange(e.target.value)}
              placeholder="Captured label text or type: e.g. DayQuil 325mg, take 2 caps every 4 hours, max 8 caps"
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: '14px',
              }}
            />
          </div>
        </div>
        <div className="ios-section-footer">
          Type or scan any prescription text to automatically extract dosage, timing, and active ingredient limits.
        </div>
      </div>

      {/* Extracted / Editable Fields */}
      {(parsedRx || editName || manualText.trim().length > 2) && (
        <div className="ios-parsed-results-container">
          <div className="ios-section">
            <div className="ios-section-header">Medication Details</div>
            <div className="ios-list">
              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Medication</div>
                <input
                  className="ios-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Medication name"
                />
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Strength</div>
                <input
                  className="ios-input"
                  value={editStrength}
                  onChange={(e) => setEditStrength(e.target.value)}
                  placeholder="e.g. 325mg"
                />
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Daily Limit</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className="ios-input"
                    style={{ width: '70px', textAlign: 'center' }}
                    value={editMaxDoses}
                    onChange={(e) => setEditMaxDoses(Number(e.target.value))}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--ios-secondary)' }}>
                    doses max / 24h (Automatic limit)
                  </span>
                </div>
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Directions</div>
                <input
                  className="ios-input"
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="e.g. Take with food every 6 hours"
                />
              </div>
            </div>
          </div>

          {/* Active Ingredients Identified */}
          {parsedRx && parsedRx.activeIngredients.length > 0 && (
            <div className="ios-section">
              <div className="ios-section-header">Active Ingredients Detected</div>
              <div className="ios-list">
                {parsedRx.activeIngredients.map((ing, i) => (
                  <div key={i} className="ios-row">
                    <div className="ios-row-content">
                      <div className="ios-row-label">{ing.name}</div>
                      <div className="ios-row-sublabel">{ing.amountMg} mg per unit</div>
                    </div>
                    <span className="ios-badge green">Monitored</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Chamber Slot Selection */}
          <div className="ios-section">
            <div className="ios-section-header">Target Dispenser Chamber</div>
            <div className="ios-list">
              <div className="ios-row">
                <div className="ios-row-label">Assign to Hardware Slot</div>
                <select
                  className="ios-input"
                  style={{ width: 'auto', fontWeight: 600 }}
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(Number(e.target.value) as 1 | 2 | 3 | 4)}
                >
                  {chambers.map((c) => (
                    <option key={c.servoId} value={c.servoId}>
                      Slot {c.servoId}: {c.medicationName ? `${c.medicationName}` : '(Unassigned)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Cross-Intake Conflict Warning Preview */}
            {potentialConflicts.length > 0 && (
              <div className="ios-safety-warning-banner" style={{ marginTop: '12px' }}>
                <div className="ios-safety-warning-icon">⚠️</div>
                <div className="ios-safety-warning-body">
                  <div className="ios-safety-warning-title">Cross-Intake Conflict Detected</div>
                  {potentialConflicts.map((c, i) => (
                    <div key={i} className="ios-safety-warning-text">
                      {c.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <button
              type="button"
              className="ios-primary-button"
              onClick={handleApply}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: 600 }}
            >
              Apply to Slot {selectedSlot} & Schedule
            </button>
          </div>
        </div>
      )}
    </IosSheet>
  );
};
