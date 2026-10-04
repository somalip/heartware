import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChamberConfig } from '../types';
import { IosSheet } from './IosSheet';
import { IosSpinner } from './IosSpinner';
import {
  prescriptionOcrService,
  ParsedPrescription,
  SAMPLE_PRESCRIPTIONS,
} from '../services/prescriptionOcrService';
import {
  searchMedications,
  findBestMatch,
  calculateAutomaticDailyLimit,
} from '../data/medicationDatabase';
import { medicationSafetyService } from '../services/medicationSafetyService';
import { triggerHaptic } from '../utils/haptics';
import { CheckCircleIcon, AlertTriangleIcon, InfoIcon, CheckIcon, SearchIcon, SparklesIcon } from './Icons';

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
  const [processingStatus, setProcessingStatus] = useState('Reading label…');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [scanSuccessBadge, setScanSuccessBadge] = useState<string | null>(null);
  const [parsedRx, setParsedRx] = useState<ParsedPrescription | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | 3 | 4>(initialSlotId);

  // Quick catalog search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showCatalogSearch, setShowCatalogSearch] = useState(false);

  // Vision AI Engine Status & Key Management
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [showAiKeyModal, setShowAiKeyModal] = useState(false);
  const [inputApiKey, setInputApiKey] = useState(() => prescriptionOcrService.getEffectiveGeminiApiKey());
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestFeedback, setKeyTestFeedback] = useState<string | null>(null);

  const refreshAiStatus = useCallback(async () => {
    const res = await prescriptionOcrService.checkGeminiApiStatus();
    setAiStatus(res);
  }, []);

  useEffect(() => {
    refreshAiStatus();
  }, [refreshAiStatus]);

  // Form states for user adjustments
  const [editName, setEditName] = useState('');
  const [editStrength, setEditStrength] = useState('');
  const [editDosage, setEditDosage] = useState('1 unit');
  const [editMaxDoses, setEditMaxDoses] = useState(4);
  const [editInstructions, setEditInstructions] = useState('');
  const [editTimes, setEditTimes] = useState<string[]>(['08:00']);
  const [editPrescribedBy, setEditPrescribedBy] = useState('');
  const [editRxNumber, setEditRxNumber] = useState('');
  const [editPharmacy, setEditPharmacy] = useState('');

  const applyParsedPrescription = useCallback((parsed: ParsedPrescription) => {
    setParsedRx(parsed);
    setEditName(parsed.medicationName);
    setEditStrength(parsed.pillStrength);
    setEditDosage(parsed.dosage || '1 unit');
    setEditMaxDoses(parsed.maxDailyDoses);
    setEditInstructions(parsed.instructions);
    setEditTimes(parsed.times && parsed.times.length > 0 ? parsed.times : ['08:00']);
    setEditPrescribedBy(parsed.prescribedBy || '');
    setEditRxNumber(parsed.rxNumber || '');
    setEditPharmacy(parsed.pharmacy || '');
  }, []);

  const resetForm = useCallback(() => {
    setParsedRx(null);
    setManualText('');
    setEditName('');
    setEditStrength('');
    setEditDosage('1 unit');
    setEditMaxDoses(4);
    setEditInstructions('');
    setEditTimes(['08:00']);
    setEditPrescribedBy('');
    setEditRxNumber('');
    setEditPharmacy('');
    setScanWarning(null);
    setScanSuccessBadge(null);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeIntervalRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (barcodeIntervalRef.current) {
      clearInterval(barcodeIntervalRef.current);
      barcodeIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const processPrescriptionText = useCallback((text: string) => {
    const parsed = prescriptionOcrService.parsePrescriptionText(text);
    applyParsedPrescription(parsed);
    triggerHaptic('success');
  }, [applyParsedPrescription]);

  // Periodic barcode scan while video viewfinder is streaming
  const startBarcodeLoop = useCallback(() => {
    const win = window as unknown as {
      BarcodeDetector?: new (options?: { formats: string[] }) => {
        detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
      };
    };

    if (typeof win.BarcodeDetector !== 'function') return;

    try {
      const detector = new win.BarcodeDetector({
        formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'data_matrix'],
      });

      barcodeIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || isProcessing) return;
        try {
          const detected = await detector.detect(videoRef.current);
          if (detected && detected.length > 0) {
            const rawCode = detected[0].rawValue.trim();
            const matched = findBestMatch(rawCode);
            if (matched) {
              triggerHaptic('success');
              if (barcodeIntervalRef.current) {
                clearInterval(barcodeIntervalRef.current);
                barcodeIntervalRef.current = null;
              }
              // Capture current frame
              if (canvasRef.current && videoRef.current) {
                const canvas = canvasRef.current;
                canvas.width = videoRef.current.videoWidth || 640;
                canvas.height = videoRef.current.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  setPreviewImage(canvas.toDataURL('image/jpeg', 0.85));
                }
              }
              stopCamera();
              const autoLimit = calculateAutomaticDailyLimit(matched);
              const resultParsed: ParsedPrescription = {
                medicationName: matched.brandName,
                pillStrength: matched.defaultStrength,
                dosage: `1 ${matched.unit}`,
                frequency: 'As directed',
                times: ['08:00'],
                instructions: matched.warnings[0] || 'Take as directed',
                prescribedBy: '',
                rxNumber: rawCode,
                pharmacy: 'Scanned Barcode',
                maxDailyDoses: autoLimit.maxDailyUnits,
                activeIngredients: matched.activeIngredients,
                rawText: `Barcode: ${rawCode} (${matched.brandName})`,
                matchedMedicationId: matched.id,
                confidence: 0.99,
                detectionSource: 'barcode',
              };
              applyParsedPrescription(resultParsed);
              setManualText(resultParsed.rawText);
              setScanSuccessBadge(`Barcode Matched: ${matched.brandName}`);
              setScanWarning(null);
            }
          }
        } catch {
          // ignore detector error in loop
        }
      }, 700);
    } catch {
      // BarcodeDetector options not supported
    }
  }, [isProcessing, stopCamera, applyParsedPrescription]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopCamera();
      let stream: MediaStream | null = null;
      try {
        // Try back/environment camera first (ideal for mobile / tablet)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback for laptops / desktop webcams
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      startBarcodeLoop();
    } catch {
      setCameraError('Unable to access camera on this device. You can upload a photo, select a preset, or type label text.');
    }
  }, [startBarcodeLoop, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

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
      setProcessingStatus('Analyzing bottle label with Vision AI & OCR…');
      setScanWarning(null);
      setScanSuccessBadge(null);

      try {
        const scanRes = await prescriptionOcrService.processImage(canvas);
        setIsProcessing(false);

        if (scanRes.text && scanRes.text.trim()) {
          setManualText(scanRes.text);
          applyParsedPrescription(scanRes.parsed);

          const sourceLabel =
            scanRes.sourceMethod === 'gemini_vision'
              ? 'Vision AI Identified'
              : scanRes.sourceMethod === 'barcode'
              ? 'Barcode Matched'
              : scanRes.sourceMethod === 'tesseract'
              ? 'OCR Text Extracted'
              : 'Prescription Analyzed';
          setScanSuccessBadge(`${sourceLabel}: ${scanRes.parsed.medicationName}`);
          if (scanRes.sourceMethod === 'tesseract' && prescriptionOcrService.getLastAiError()) {
            setScanWarning(
              `Cloud AI is blocked (${prescriptionOcrService.getLastAiError()}). Parsed with local OCR. Tap "Fix / Enter Key" above to enable Gemini Vision.`
            );
          }
          triggerHaptic('success');
        } else {
          setScanWarning(
            'Could not extract legible text from this frame. Pick your medication from the presets below, search our catalog, or type the label text.'
          );
          triggerHaptic('light');
        }
      } catch (err) {
        console.error('Scan capture error:', err);
        setIsProcessing(false);
        setScanWarning('Vision scanning encountered an issue. Please choose a preset below or enter the details.');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('light');
    setIsProcessing(true);
    setProcessingStatus('Reading uploaded image…');
    setScanWarning(null);
    setScanSuccessBadge(null);

    try {
      const dataUrl = await prescriptionOcrService.readImageFile(file);
      setPreviewImage(dataUrl);

      const scanRes = await prescriptionOcrService.processImage(dataUrl);
      setIsProcessing(false);

      if (scanRes.text && scanRes.text.trim()) {
        setManualText(scanRes.text);
        applyParsedPrescription(scanRes.parsed);

        const sourceLabel =
          scanRes.sourceMethod === 'gemini_vision'
            ? 'Vision AI Identified'
            : scanRes.sourceMethod === 'barcode'
            ? 'Barcode Matched'
            : 'Image Text Extracted';
        setScanSuccessBadge(`${sourceLabel}: ${scanRes.parsed.medicationName}`);
        if (scanRes.sourceMethod === 'tesseract' && prescriptionOcrService.getLastAiError()) {
          setScanWarning(
            `Cloud AI is blocked (${prescriptionOcrService.getLastAiError()}). Parsed with local OCR. Tap "Fix / Enter Key" above to enable Gemini Vision.`
          );
        }
        triggerHaptic('success');
      } else {
        setScanWarning(
          'Could not detect clear text on this photo. You can pick your medication from the presets below, search our catalog, or type the label.'
        );
        triggerHaptic('light');
      }
    } catch (err) {
      console.error('File upload error:', err);
      setIsProcessing(false);
      setScanWarning('Could not process this file. Please pick a preset or type the label text.');
    }
  };

  const handleManualTextChange = (text: string) => {
    setManualText(text);
    if (text.trim().length > 2) {
      processPrescriptionText(text);
    }
  };

  const handleSelectPreset = (medId: string) => {
    const med = findBestMatch(medId);
    if (!med) return;

    triggerHaptic('selection');
    const autoLimit = calculateAutomaticDailyLimit(med);

    const presetParsed: ParsedPrescription = {
      medicationName: med.brandName,
      pillStrength: med.defaultStrength,
      dosage: `1 ${med.unit}`,
      frequency: med.minDoseIntervalHours === 24 ? 'Once daily' : `Every ${med.minDoseIntervalHours} hours`,
      times: med.minDoseIntervalHours === 24 ? ['08:00'] : ['08:00', '20:00'],
      instructions: med.warnings[0] || 'Take as directed',
      prescribedBy: '',
      rxNumber: med.barcodes?.[0] || '',
      pharmacy: 'Catalog Presets',
      maxDailyDoses: autoLimit.maxDailyUnits,
      activeIngredients: med.activeIngredients,
      rawText: `${med.brandName} - ${med.genericName} (${med.defaultStrength})`,
      matchedMedicationId: med.id,
      confidence: 1.0,
      detectionSource: 'manual',
    };

    applyParsedPrescription(presetParsed);
    setManualText(presetParsed.rawText);
    setScanSuccessBadge(`Selected: ${med.brandName}`);
    setScanWarning(null);
  };

  const handleSelectSample = (sample: typeof SAMPLE_PRESCRIPTIONS[0]) => {
    triggerHaptic('selection');
    setManualText(sample.text);
    processPrescriptionText(sample.text);
    setScanSuccessBadge(`Sample Loaded: ${sample.label}`);
    setScanWarning(null);
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
      medicationName: editName.trim(),
      pillStrength: editStrength.trim(),
      activeIngredients: parsedRx?.activeIngredients || [],
      maxDailyDoses: editMaxDoses,
      dosage: editDosage.trim() || parsedRx?.dosage || '1 unit',
      times: editTimes,
      instructions: editInstructions.trim(),
      prescribedBy: editPrescribedBy.trim() || parsedRx?.prescribedBy || '',
    });
    onClose();
  };

  const searchResults = searchQuery.trim() ? searchMedications(searchQuery).slice(0, 6) : [];

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
      {/* AI Vision Engine Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 0 12px 0',
          padding: '8px 12px',
          borderRadius: '10px',
          backgroundColor: aiStatus?.ok ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 149, 0, 0.12)',
          border: `1px solid ${aiStatus?.ok ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 149, 0, 0.3)'}`,
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <span>{aiStatus?.ok ? <CheckCircleIcon size={16} color="var(--ios-green)" /> : <AlertTriangleIcon size={16} color="var(--ios-orange)" />}</span>
          <span
            style={{
              fontWeight: 600,
              color: aiStatus?.ok ? '#34c759' : '#ff9500',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {aiStatus?.ok
              ? 'Gemini 3.8 Vision AI Active'
              : 'Gemini Cloud AI Blocked (Using Local OCR)'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setInputApiKey(prescriptionOcrService.getEffectiveGeminiApiKey());
            setKeyTestFeedback(null);
            setShowAiKeyModal(true);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ios-label)',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
            padding: '2px 6px',
            whiteSpace: 'nowrap',
          }}
        >
          {aiStatus?.ok ? 'AI Settings' : 'Fix / Enter Key'}
        </button>
      </div>

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
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>Camera Viewfinder</span>
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
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span>Upload Photo</span>
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
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="ios-row-action"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Photo from Device
                </button>
                <button
                  type="button"
                  className="ios-row-action"
                  onClick={() => startCamera()}
                >
                  Retry Camera
                </button>
              </div>
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
                  <div className="ios-viewfinder-hint">Align Bottle Label or Barcode</div>
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
          <div className="ios-upload-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--ios-label)' }}
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="ios-upload-title">Choose Photo or Prescription Label</div>
          <div className="ios-upload-subtitle">Select any photo of your pill bottle, box, or prescription</div>
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
              resetForm();
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
          <IosSpinner size={20} color="var(--ios-label)" />
          <span>{processingStatus}</span>
        </div>
      )}

      {/* Success Badge */}
      {scanSuccessBadge && !isProcessing && (
        <div className="ios-scan-status-banner success">
          <span style={{ fontSize: '16px' }}><CheckIcon size={16} color="var(--ios-green)" /></span>
          <span>{scanSuccessBadge}</span>
        </div>
      )}

      {/* Scan Warning Banner */}
      {scanWarning && !isProcessing && (
        <div className="ios-scan-status-banner warning">
          <span style={{ fontSize: '16px' }}><InfoIcon size={16} color="var(--ios-orange)" /></span>
          <span>{scanWarning}</span>
        </div>
      )}

      {/* Quick Presets Section */}
      <div className="ios-section" style={{ marginTop: '10px' }}>
        <div className="ios-section-header">Popular Medication Presets (1-Tap Fill)</div>
        <div style={{ padding: '0 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { id: 'dayquil-cold-flu', label: 'DayQuil' },
            { id: 'nyquil-cold-flu', label: 'NyQuil' },
            { id: 'tylenol-extra-strength', label: 'Tylenol 500mg' },
            { id: 'advil-ibuprofen', label: 'Advil 200mg' },
            { id: 'aleve-naproxen', label: 'Aleve 220mg' },
            { id: 'amoxicillin-rx', label: 'Amoxicillin 500mg' },
            { id: 'lisinopril-rx', label: 'Lisinopril 10mg' },
            { id: 'metformin-rx', label: 'Metformin 500mg' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="ios-preset-chip"
              onClick={() => handleSelectPreset(preset.id)}
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sample Test Labels Row */}
      <div className="ios-section">
        <div className="ios-section-header">Try Sample Prescription Labels</div>
        <div style={{ padding: '0 16px', display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px' }}>
          {SAMPLE_PRESCRIPTIONS.map((sample, i) => (
            <button
              key={i}
              type="button"
              className="ios-sample-chip"
              onClick={() => handleSelectSample(sample)}
              title={sample.summary}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Catalog Search Toggle */}
      <div style={{ padding: '0 16px 8px' }}>
        <button
          type="button"
          className="ios-scan-shortcut-btn"
          style={{ padding: '8px 12px', fontSize: '13px' }}
          onClick={() => setShowCatalogSearch(!showCatalogSearch)}
        >
          <SearchIcon size={16} color="currentColor" /> {showCatalogSearch ? 'Hide Catalog Search' : 'Search All 16+ Catalog Medications'}
        </button>
      </div>

      {showCatalogSearch && (
        <div className="ios-section">
          <div className="ios-list">
            <div className="ios-row">
              <input
                className="ios-input"
                style={{ width: '100%' }}
                placeholder="Search catalog (e.g. Lipitor, Benadryl, Mucinex)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            {searchResults.map((med) => (
              <div
                key={med.id}
                className="ios-row interactive"
                onClick={() => {
                  handleSelectPreset(med.id);
                  setShowCatalogSearch(false);
                }}
              >
                <div className="ios-row-content">
                  <div className="ios-row-label">{med.brandName}</div>
                  <div className="ios-row-sublabel">
                    {med.genericName} · {med.defaultStrength}
                  </div>
                </div>
                <span className="ios-badge green">Select</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Label Text Input / Review */}
      <div className="ios-section">
        <div className="ios-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Prescription Label Text</span>
          {manualText.trim().length > 3 && (
            <button
              type="button"
              className="ios-badge"
              style={{
                background: 'var(--ios-fill)',
                color: 'var(--ios-label)',
                border: '1px solid var(--ios-separator)',
                padding: '3px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
              onClick={() => {
                const cleaned = prescriptionOcrService.reconstructCleanLabelText(manualText);
                setManualText(cleaned);
                processPrescriptionText(cleaned);
                triggerHaptic('success');
              }}
              title="Clean and reconstruct raw OCR text into structured label format"
            >
              <SparklesIcon size={16} color="currentColor" /> Clean & Format
            </button>
          )}
        </div>
        <div className="ios-list">
          <div className="ios-row">
            <textarea
              className="ios-input"
              rows={5}
              value={manualText}
              onChange={(e) => handleManualTextChange(e.target.value)}
              placeholder="Captured label text or type: e.g. DayQuil 325mg, take 2 caps every 4 hours, max 8 caps"
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            />
          </div>
        </div>
        <div className="ios-section-footer">
          Repairs raw OCR noise and automatically extracts medication, dosage, directions, and safe limits.
        </div>
      </div>

      {/* Extracted / Editable Fields */}
      {(parsedRx || editName || manualText.trim().length > 2) && (
        <div className="ios-parsed-results-container">
          {parsedRx && (
            <div className="ios-scan-status-banner success" style={{ margin: '0 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span><CheckIcon size={16} color="#fff" /></span>
                <span>Bottle Extracted ({parsedRx.detectionSource === 'tesseract' ? 'OCR Text' : parsedRx.detectionSource === 'barcode' ? 'Barcode Scan' : parsedRx.detectionSource === 'gemini_vision' ? 'Vision AI' : 'Clinical Parser'})</span>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {parsedRx.medicationName} {parsedRx.pillStrength} · {parsedRx.dosage} · {parsedRx.frequency}
                {parsedRx.prescribedBy ? ` · Dr: ${parsedRx.prescribedBy}` : ''}
                {parsedRx.rxNumber ? ` · Rx: ${parsedRx.rxNumber}` : ''}
              </div>
            </div>
          )}

          <div className="ios-section">
            <div className="ios-section-header">Medication & Bottle Details</div>
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
                  placeholder="e.g. 20mg, 50mg, 500mg"
                />
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Dosage</div>
                <input
                  className="ios-input"
                  value={editDosage}
                  onChange={(e) => setEditDosage(e.target.value)}
                  placeholder="e.g. 1 tablet, 2 caplets"
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

              <div className="ios-row" style={{ alignItems: 'flex-start', padding: '10px 16px' }}>
                <div style={{ width: '110px', color: 'var(--ios-secondary)', paddingTop: '4px' }}>Schedule</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <input
                    className="ios-input"
                    value={editTimes.join(', ')}
                    onChange={(e) => {
                      const parts = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
                      setEditTimes(parts.length > 0 ? parts : ['08:00']);
                    }}
                    placeholder="e.g. 08:00, 20:00"
                  />
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ios-preset-chip"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => setEditTimes(['08:00'])}
                    >
                      Morning (08:00)
                    </button>
                    <button
                      type="button"
                      className="ios-preset-chip"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => setEditTimes(['08:00', '20:00'])}
                    >
                      BID (08:00, 20:00)
                    </button>
                    <button
                      type="button"
                      className="ios-preset-chip"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => setEditTimes(['08:00', '14:00', '20:00'])}
                    >
                      TID (3x daily)
                    </button>
                    <button
                      type="button"
                      className="ios-preset-chip"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => setEditTimes(['21:00'])}
                    >
                      Bedtime (21:00)
                    </button>
                  </div>
                </div>
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Directions</div>
                <input
                  className="ios-input"
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="e.g. Take 1 tablet daily in the morning"
                />
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Prescriber</div>
                <input
                  className="ios-input"
                  value={editPrescribedBy}
                  onChange={(e) => setEditPrescribedBy(e.target.value)}
                  placeholder="e.g. Dr. Emily Watson, MD"
                />
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Rx #</div>
                <input
                  className="ios-input"
                  value={editRxNumber}
                  onChange={(e) => setEditRxNumber(e.target.value)}
                  placeholder="e.g. 6492018-04"
                />
              </div>

              <div className="ios-row">
                <div style={{ width: '110px', color: 'var(--ios-secondary)' }}>Pharmacy</div>
                <input
                  className="ios-input"
                  value={editPharmacy}
                  onChange={(e) => setEditPharmacy(e.target.value)}
                  placeholder="e.g. CVS Pharmacy"
                />
              </div>
            </div>
          </div>

          {/* Active Ingredients Identified */}
          {parsedRx && parsedRx.activeIngredients.length > 0 && (
            <div className="ios-section">
              <div className="ios-section-header">Active Ingredients Detected & Monitored</div>
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

          {/* Target Bottle Selection */}
          <div className="ios-section">
            <div className="ios-section-header">Target Dispenser Bottle</div>
            <div className="ios-list">
              <div className="ios-row">
                <div className="ios-row-label">Assign to Hardware Bottle</div>
                <select
                  className="ios-input"
                  style={{ width: 'auto', fontWeight: 600 }}
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(Number(e.target.value) as 1 | 2 | 3 | 4)}
                >
                  {chambers.map((c) => (
                    <option key={c.servoId} value={c.servoId}>
                      Bottle {c.servoId}: {c.medicationName ? `${c.medicationName}` : '(Unassigned)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Cross-Intake Conflict Warning Preview */}
            {potentialConflicts.length > 0 && (
              <div className="ios-safety-warning-banner" style={{ marginTop: '12px' }}>
                <AlertTriangleIcon size={20} color="var(--ios-orange)" />
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
              className="ios-btn-primary"
              onClick={handleApply}
            >
              Apply to Bottle {selectedSlot} & Schedule
            </button>
          </div>
        </div>
      )}

      {/* AI Key Configuration Modal */}
      {showAiKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-bg-primary, #1c1c1e)',
              color: 'var(--color-text-primary, #ffffff)',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
              Gemini Vision AI Setup
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', opacity: 0.8, lineHeight: 1.4 }}>
              Your Firebase web key is restricted by Google Cloud and blocks Gemini API calls (<code>API_KEY_SERVICE_BLOCKED</code>).
              To unlock full Vision AI with near-100% accuracy, paste a free key from Google AI Studio.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', opacity: 0.9 }}>
                Google AI Studio API Key (somalipdev@gmail.com)
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={inputApiKey}
                onChange={(e) => setInputApiKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {keyTestFeedback && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  marginBottom: '14px',
                  backgroundColor: keyTestFeedback.startsWith('SUCCESS') ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                  color: keyTestFeedback.startsWith('SUCCESS') ? '#34c759' : '#ff453a',
                  wordBreak: 'break-word',
                }}
              >
                {keyTestFeedback}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: 'var(--ios-label)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  marginRight: 'auto',
                }}
              >
                Get Free Key ↗
              </a>
              <button
                type="button"
                onClick={() => setShowAiKeyModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--ios-separator)',
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTestingKey}
                onClick={async () => {
                  setIsTestingKey(true);
                  setKeyTestFeedback(null);
                  prescriptionOcrService.setCustomGeminiApiKey(inputApiKey.trim());
                  const res = await prescriptionOcrService.checkGeminiApiStatus();
                  setIsTestingKey(false);
                  setAiStatus(res);
                  if (res.ok) {
                     setKeyTestFeedback('SUCCESS: Connected! Gemini 2.0 Flash is active.');
                    setTimeout(() => setShowAiKeyModal(false), 1200);
                  } else {
                     setKeyTestFeedback(`ERROR: Google Error: ${res.reason}`);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--ios-label)',
                  color: 'var(--ios-bg)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isTestingKey ? 'wait' : 'pointer',
                }}
              >
                {isTestingKey ? 'Verifying…' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </IosSheet>
  );
};
