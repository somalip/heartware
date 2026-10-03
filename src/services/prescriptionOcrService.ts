import { ActiveIngredient } from '../types';
import {
  findBestMatch,
  calculateAutomaticDailyLimit,
} from '../data/medicationDatabase';

export interface ParsedPrescription {
  medicationName: string;
  pillStrength: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
  prescribedBy: string;
  rxNumber: string;
  pharmacy: string;
  maxDailyDoses: number;
  activeIngredients: ActiveIngredient[];
  rawText: string;
  matchedMedicationId?: string;
  confidence: number;
}

export const prescriptionOcrService = {
  /**
   * Attempts to extract text blocks from an image or canvas using native browser TextDetector.
   */
  async detectTextFromImage(imageSource: CanvasImageSource | ImageBitmap): Promise<string> {
    try {
      const win = window as unknown as { TextDetector?: new () => { detect: (src: CanvasImageSource | ImageBitmap) => Promise<{ rawValue: string }[]> } };
      if (typeof win.TextDetector === 'function') {
        const detector = new win.TextDetector();
        const detected = await detector.detect(imageSource);
        if (detected && detected.length > 0) {
          return detected.map((d) => d.rawValue).join('\n');
        }
      }
    } catch {
      // Shape detection unavailable or unsupported in current context
    }
    return '';
  },
  /**
   * Intelligently parses raw prescription label text into structured medication details.
   */
  parsePrescriptionText(rawText: string): ParsedPrescription {
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. Detect Medication Name
    let detectedName = '';
    let matchedMed = null;

    // Direct check for "MEDICATION:" or "DRUG:" prefix
    const medLine = lines.find((l) => /^(MEDICATION|DRUG|RX\s*NAME|PRODUCT)[\s:]+/i.test(l));
    if (medLine) {
      detectedName = medLine.replace(/^(MEDICATION|DRUG|RX\s*NAME|PRODUCT)[\s:]+/i, '').trim();
    }

    // Try finding best database match across all lines
    if (!detectedName) {
      for (const line of lines) {
        const candidate = findBestMatch(line);
        if (candidate) {
          detectedName = candidate.brandName;
          matchedMed = candidate;
          break;
        }
      }
    } else {
      matchedMed = findBestMatch(detectedName);
    }

    // Fallback if still not matched
    if (!detectedName) {
      // Find prominent title line that isn't pharmacy or doctor
      const candidateLine = lines.find(
        (l) =>
          !/(PHARMACY|DR\.|DOCTOR|PATIENT|RX\s*#|QTY|REFILL|DIRECTIONS|TAKE|WARNING)/i.test(l) &&
          l.length > 3
      );
      detectedName = candidateLine || 'Prescription Medication';
      matchedMed = findBestMatch(detectedName);
    }

    // 2. Detect Strength
    let strength = '';
    const strengthMatch = rawText.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g)\b/i);
    if (strengthMatch) {
      strength = `${strengthMatch[1]}${strengthMatch[2].toLowerCase()}`;
    } else if (matchedMed) {
      strength = matchedMed.defaultStrength;
    } else {
      strength = '1 tablet';
    }

    // 3. Detect Rx Number
    let rxNumber = '';
    const rxMatch = rawText.match(/\b(?:RX\s*#?|PRESCRIPTION\s*#?)[\s:]*([A-Z0-9\-]+)/i);
    if (rxMatch) {
      rxNumber = rxMatch[1];
    }

    // 4. Detect Prescribing Doctor
    let prescribedBy = '';
    const docMatch = rawText.match(/(?:DR\.|DOCTOR|PRESCRIBER)[\s:]+([A-Z\s\.]+?)(?:,?\s*MD|\n|$)/i);
    if (docMatch) {
      prescribedBy = `Dr. ${docMatch[1].trim().replace(/^DR\.\s*/i, '')}`;
    }

    // 5. Detect Pharmacy
    let pharmacy = 'Community Pharmacy';
    const pharmMatch = rawText.match(/(CVS\s*PHARMACY|WALGREENS|RITE\s*AID|HEALTHFIRST|WALMART|COSTCO|KROGER)/i);
    if (pharmMatch) {
      pharmacy = pharmMatch[1].toUpperCase();
    }

    // 6. Detect Instructions & Schedule
    let instructions = '';
    const dirMatch = rawText.match(/(?:DIRECTIONS|SIG|TAKE)[\s:]+([^\n]+(?:\n[^\n]+)?)/i);
    if (dirMatch) {
      instructions = dirMatch[1].trim();
    } else {
      instructions = 'Take as directed by physician';
    }

    // 7. Parse Frequency & Dosage Times
    const lowerText = rawText.toLowerCase();
    const isAsNeeded = lowerText.includes('as needed') || lowerText.includes('prn');
    let times: string[] = ['08:00'];
    let frequency = 'Once daily';

    if (isAsNeeded) {
      times = ['As needed'];
      frequency = 'As needed (PRN)';
    } else if (lowerText.includes('three times') || lowerText.includes('every 8 hours') || lowerText.includes('3 times')) {
      times = ['08:00', '16:00', '00:00'];
      frequency = '3 times daily (every 8 hours)';
    } else if (lowerText.includes('twice daily') || lowerText.includes('every 12 hours') || lowerText.includes('2 times')) {
      times = ['08:00', '20:00'];
      frequency = 'Twice daily (every 12 hours)';
    } else if (lowerText.includes('four times') || lowerText.includes('every 6 hours')) {
      times = ['08:00', '14:00', '20:00', '02:00'];
      frequency = '4 times daily';
    } else if (lowerText.includes('once daily') || lowerText.includes('every morning') || lowerText.includes('in the morning')) {
      times = ['08:00'];
      frequency = 'Once daily (morning)';
    } else if (lowerText.includes('bedtime') || lowerText.includes('at night')) {
      times = ['21:00'];
      frequency = 'Once daily (bedtime)';
    }

    // 8. Active Ingredients & Automatic Daily Limits
    let activeIngredients: ActiveIngredient[] = [];
    if (matchedMed && matchedMed.activeIngredients.length > 0) {
      activeIngredients = matchedMed.activeIngredients;
    } else {
      // Heuristic extraction for active ingredients in text
      if (lowerText.includes('acetaminophen') || lowerText.includes('apap')) {
        activeIngredients.push({ name: 'Acetaminophen', amountMg: 325 });
      }
      if (lowerText.includes('ibuprofen')) {
        activeIngredients.push({ name: 'Ibuprofen', amountMg: 200 });
      }
      if (lowerText.includes('naproxen')) {
        activeIngredients.push({ name: 'Naproxen', amountMg: 220 });
      }
      if (lowerText.includes('amoxicillin')) {
        activeIngredients.push({ name: 'Amoxicillin', amountMg: 500 });
      }
      if (lowerText.includes('lisinopril')) {
        activeIngredients.push({ name: 'Lisinopril', amountMg: 10 });
      }
    }

    const { maxDailyUnits } = calculateAutomaticDailyLimit({
      maxDailyUnits: matchedMed?.maxDailyUnits,
      activeIngredients,
      pillStrength: strength,
    });

    // Check if raw label text specifically states a max limit (e.g. "DO NOT EXCEED 8 LIQUICAPS")
    let finalLimit = maxDailyUnits;
    const explicitLimitMatch = rawText.match(/(?:NOT\s*EXCEED|MAX(?:IMUM)?)\s*(\d+)\s*(?:TABLETS|CAPSULES|CAPLETS|LIQUICAPS|PILLS|DOSES)?/i);
    if (explicitLimitMatch) {
      const explicitNum = parseInt(explicitLimitMatch[1], 10);
      if (explicitNum > 0 && explicitNum <= 24) {
        finalLimit = explicitNum;
      }
    }

    return {
      medicationName: matchedMed ? matchedMed.brandName : detectedName,
      pillStrength: strength,
      dosage: '1 unit',
      frequency,
      times,
      instructions,
      prescribedBy,
      rxNumber,
      pharmacy,
      maxDailyDoses: finalLimit,
      activeIngredients,
      rawText,
      matchedMedicationId: matchedMed?.id,
      confidence: matchedMed ? 0.95 : 0.75,
    };
  },

  /**
   * Helper to convert an image File to a Data URL for image rendering.
   */
  async readImageFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};
