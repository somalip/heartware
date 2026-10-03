import { MedicationReference, ActiveIngredient } from '../types';

/**
 * Standard clinical safe daily maximum intake (in milligrams) for active ingredients.
 * Sourced from FDA, CDC, and USP clinical dosing monographs.
 */
export const INGREDIENT_DAILY_LIMITS: Record<
  string,
  {
    maxDailyMg: number;
    description: string;
    criticalWarning: string;
    drugClass: 'analgesic' | 'nsaid' | 'antihistamine' | 'decongestant' | 'cough_suppressant' | 'expectorant' | 'antibiotic' | 'other';
  }
> = {
  acetaminophen: {
    maxDailyMg: 3000, // Safe conservative OTC limit (FDA absolute max 4,000mg)
    description: 'Pain reliever / fever reducer (APAP)',
    criticalWarning: 'Exceeding 3,000 mg/day across all medications poses severe acute liver injury risk.',
    drugClass: 'analgesic',
  },
  ibuprofen: {
    maxDailyMg: 1200, // Standard OTC max (clinician supervised max 3200mg)
    description: 'Nonsteroidal anti-inflammatory drug (NSAID)',
    criticalWarning: 'Excessive NSAID intake can cause gastrointestinal ulceration, internal bleeding, and kidney impairment.',
    drugClass: 'nsaid',
  },
  naproxen: {
    maxDailyMg: 660, // OTC daily maximum (220mg up to 3x/day)
    description: 'Long-acting nonsteroidal anti-inflammatory drug (NSAID)',
    criticalWarning: 'Do not combine with Ibuprofen or other NSAIDs to avoid severe gastrointestinal toxicity.',
    drugClass: 'nsaid',
  },
  aspirin: {
    maxDailyMg: 4000,
    description: 'Salicylate pain reliever / blood thinner',
    criticalWarning: 'High doses can lead to salicylate toxicity and acute bleeding.',
    drugClass: 'nsaid',
  },
  diphenhydramine: {
    maxDailyMg: 300,
    description: 'First-generation sedating antihistamine',
    criticalWarning: 'Excessive intake causes extreme sedation, anticholinergic toxicity, and delirium.',
    drugClass: 'antihistamine',
  },
  doxylamine: {
    maxDailyMg: 75,
    description: 'First-generation sedating antihistamine',
    criticalWarning: 'Strong sedative; avoid combining with other antihistamines or sedatives.',
    drugClass: 'antihistamine',
  },
  dextromethorphan: {
    maxDailyMg: 120,
    description: 'Antitussive cough suppressant (DXM)',
    criticalWarning: 'Excessive doses cause serotonin syndrome, hallucinations, and respiratory depression.',
    drugClass: 'cough_suppressant',
  },
  phenylephrine: {
    maxDailyMg: 60,
    description: 'Sympathomimetic nasal decongestant',
    criticalWarning: 'Can cause severe hypertension, cardiac palpitations, and tachycardia.',
    drugClass: 'decongestant',
  },
  pseudoephedrine: {
    maxDailyMg: 240,
    description: 'Systemic nasal decongestant',
    criticalWarning: 'Marked cardiovascular stimulant. Exceeding 240mg/day causes severe blood pressure spike.',
    drugClass: 'decongestant',
  },
  guaifenesin: {
    maxDailyMg: 2400,
    description: 'Mucus thinning expectorant',
    criticalWarning: 'High intake can cause nausea, vomiting, and kidney stones.',
    drugClass: 'expectorant',
  },
  cetirizine: {
    maxDailyMg: 10,
    description: 'Second-generation non-sedating antihistamine',
    criticalWarning: 'Do not exceed 10mg in 24 hours unless directed by an allergist.',
    drugClass: 'antihistamine',
  },
  loratadine: {
    maxDailyMg: 10,
    description: 'Second-generation non-sedating antihistamine',
    criticalWarning: 'Do not exceed 10mg in 24 hours.',
    drugClass: 'antihistamine',
  },
  fexofenadine: {
    maxDailyMg: 180,
    description: 'Second-generation non-sedating antihistamine',
    criticalWarning: 'Maximum 180mg in 24 hours. Take with water, avoid grapefruit juice.',
    drugClass: 'antihistamine',
  },
  amoxicillin: {
    maxDailyMg: 1500,
    description: 'Broad-spectrum penicillin antibiotic',
    criticalWarning: 'Follow exact prescriber interval to prevent resistance; do not double-dose.',
    drugClass: 'antibiotic',
  },
  lisinopril: {
    maxDailyMg: 40,
    description: 'ACE inhibitor for blood pressure & cardiovascular protection',
    criticalWarning: 'Exceeding prescribed dose may cause profound hypotension and hyperkalemia.',
    drugClass: 'other',
  },
  metformin: {
    maxDailyMg: 2550,
    description: 'Biguanide oral antidiabetic',
    criticalWarning: 'Excessive intake carries risk of rare but fatal lactic acidosis.',
    drugClass: 'other',
  },
  atorvastatin: {
    maxDailyMg: 80,
    description: 'HMG-CoA reductase inhibitor (Statin)',
    criticalWarning: 'High doses can lead to rhabdomyolysis and elevated liver transaminases.',
    drugClass: 'other',
  },
};

/**
 * Standardizes an ingredient name to match INGREDIENT_DAILY_LIMITS keys.
 */
export function normalizeIngredientName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower.includes('acetaminophen') || lower.includes('apap') || lower.includes('paracetamol')) {
    return 'acetaminophen';
  }
  if (lower.includes('ibuprofen')) return 'ibuprofen';
  if (lower.includes('naproxen')) return 'naproxen';
  if (lower.includes('aspirin') || lower.includes('acetylsalicylic')) return 'aspirin';
  if (lower.includes('diphenhydramine')) return 'diphenhydramine';
  if (lower.includes('doxylamine')) return 'doxylamine';
  if (lower.includes('dextromethorphan') || lower.includes('dxm')) return 'dextromethorphan';
  if (lower.includes('phenylephrine')) return 'phenylephrine';
  if (lower.includes('pseudoephedrine')) return 'pseudoephedrine';
  if (lower.includes('guaifenesin')) return 'guaifenesin';
  if (lower.includes('cetirizine')) return 'cetirizine';
  if (lower.includes('loratadine')) return 'loratadine';
  if (lower.includes('fexofenadine')) return 'fexofenadine';
  if (lower.includes('amoxicillin')) return 'amoxicillin';
  if (lower.includes('lisinopril')) return 'lisinopril';
  if (lower.includes('metformin')) return 'metformin';
  if (lower.includes('atorvastatin')) return 'atorvastatin';
  return lower;
}

/**
 * Comprehensive clinical medication reference catalog.
 */
export const MEDICATION_DATABASE: MedicationReference[] = [
  {
    id: 'dayquil-cold-flu',
    brandName: 'DayQuil Cold & Flu',
    genericName: 'Acetaminophen / Dextromethorphan HBr / Phenylephrine HCl',
    category: 'cold_flu',
    defaultStrength: '325mg / 10mg / 5mg',
    unit: 'liquicap',
    activeIngredients: [
      { name: 'Acetaminophen', amountMg: 325 },
      { name: 'Dextromethorphan HBr', amountMg: 10 },
      { name: 'Phenylephrine HCl', amountMg: 5 },
    ],
    maxDailyUnits: 8, // 8 liquicaps = 2,600mg Acetaminophen (well within safe 3,000mg limit)
    minDoseIntervalHours: 4,
    warnings: [
      'Contains Acetaminophen. Do NOT take with other products containing Acetaminophen (Tylenol, NyQuil, Excedrin).',
      'Severe liver damage warning if daily limit exceeded.',
      'Do not take more than 8 LiquiCaps in 24 hours.',
    ],
    description: 'Non-drowsy daytime relief for nasal congestion, sore throat, fever, cough, and minor aches.',
  },
  {
    id: 'nyquil-cold-flu',
    brandName: 'NyQuil Cold & Flu',
    genericName: 'Acetaminophen / Dextromethorphan HBr / Doxylamine Succinate',
    category: 'cold_flu',
    defaultStrength: '325mg / 10mg / 6.25mg',
    unit: 'liquicap',
    activeIngredients: [
      { name: 'Acetaminophen', amountMg: 325 },
      { name: 'Dextromethorphan HBr', amountMg: 10 },
      { name: 'Doxylamine Succinate', amountMg: 6.25 },
    ],
    maxDailyUnits: 8,
    minDoseIntervalHours: 6,
    warnings: [
      'Contains Acetaminophen. Combined intake with DayQuil or Tylenol can easily cause liver overdose.',
      'Causes marked drowsiness. Do not drive or operate machinery.',
    ],
    description: 'Nighttime relief for headache, fever, sore throat, sneezing, runny nose, and cough.',
  },
  {
    id: 'tylenol-extra-strength',
    brandName: 'Tylenol Extra Strength',
    genericName: 'Acetaminophen (APAP)',
    category: 'analgesic',
    defaultStrength: '500mg',
    unit: 'caplet',
    activeIngredients: [{ name: 'Acetaminophen', amountMg: 500 }],
    maxDailyUnits: 6, // 6 caplets = 3,000mg Acetaminophen safe limit
    minDoseIntervalHours: 6,
    warnings: [
      'Active ingredient is Acetaminophen. Maximum 6 caplets (3,000mg) per 24 hours.',
      'Check all other medications (DayQuil, NyQuil, Percocet) to avoid double intake.',
    ],
    description: 'Fast pain relief and fever reducer without stomach irritation.',
  },
  {
    id: 'tylenol-regular-strength',
    brandName: 'Tylenol Regular Strength',
    genericName: 'Acetaminophen (APAP)',
    category: 'analgesic',
    defaultStrength: '325mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Acetaminophen', amountMg: 325 }],
    maxDailyUnits: 9, // 9 * 325 = 2,925mg
    minDoseIntervalHours: 4,
    warnings: [
      'Contains Acetaminophen. Do not exceed 9-10 tablets (3,000mg-3,250mg) in 24 hours.',
    ],
    description: 'Standard relief for mild-to-moderate fever, headache, and muscle aches.',
  },
  {
    id: 'excedrin-extra-strength',
    brandName: 'Excedrin Extra Strength',
    genericName: 'Acetaminophen / Aspirin / Caffeine',
    category: 'analgesic',
    defaultStrength: '250mg / 250mg / 65mg',
    unit: 'caplet',
    activeIngredients: [
      { name: 'Acetaminophen', amountMg: 250 },
      { name: 'Aspirin', amountMg: 250 },
    ],
    maxDailyUnits: 8, // 8 * 250 = 2,000mg Acetaminophen & Aspirin
    minDoseIntervalHours: 6,
    warnings: [
      'Dual-active formulation: contains BOTH Acetaminophen and Aspirin (NSAID).',
      'High risk of cross-intake with both Tylenol and Advil/Aleve.',
    ],
    description: 'Combination headache and migraine relief formula.',
  },
  {
    id: 'advil-ibuprofen',
    brandName: 'Advil / Motrin',
    genericName: 'Ibuprofen',
    category: 'nsaid',
    defaultStrength: '200mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Ibuprofen', amountMg: 200 }],
    maxDailyUnits: 6, // 6 * 200mg = 1,200mg safe OTC cap
    minDoseIntervalHours: 4,
    warnings: [
      'NSAID pain reliever. Do not exceed 6 tablets (1,200mg) per day without medical advice.',
      'Do not combine with Naproxen (Aleve) or Aspirin due to gastric bleeding risks.',
    ],
    description: 'Anti-inflammatory relief for joint inflammation, muscle aches, and fever.',
  },
  {
    id: 'aleve-naproxen',
    brandName: 'Aleve',
    genericName: 'Naproxen Sodium',
    category: 'nsaid',
    defaultStrength: '220mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Naproxen', amountMg: 220 }],
    maxDailyUnits: 3, // 3 * 220mg = 660mg daily cap
    minDoseIntervalHours: 8,
    warnings: [
      'Long-lasting 12-hour NSAID. Maximum 3 tablets (660mg) in 24 hours.',
      'Do NOT take concurrently with Ibuprofen (Advil).',
    ],
    description: 'Long-lasting 12-hour all-day arthritis and muscular pain relief.',
  },
  {
    id: 'benadryl-allergy',
    brandName: 'Benadryl Allergy',
    genericName: 'Diphenhydramine HCl',
    category: 'allergy',
    defaultStrength: '25mg',
    unit: 'capsule',
    activeIngredients: [{ name: 'Diphenhydramine', amountMg: 25 }],
    maxDailyUnits: 6, // 6 * 25mg = 150mg (max 300mg/day)
    minDoseIntervalHours: 4,
    warnings: [
      'First-generation antihistamine causing drowsiness.',
      'Do not combine with sleep aids or NyQuil.',
    ],
    description: 'Relief for allergy symptoms, hives, itchy eyes, and acute allergic reactions.',
  },
  {
    id: 'sudafed-congestion',
    brandName: 'Sudafed Sinus Congestion',
    genericName: 'Pseudoephedrine HCl',
    category: 'cold_flu',
    defaultStrength: '30mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Pseudoephedrine', amountMg: 30 }],
    maxDailyUnits: 8, // 8 * 30mg = 240mg daily max
    minDoseIntervalHours: 4,
    warnings: [
      'Stimulant decongestant. Maximum 240mg in 24 hours.',
      'Monitor blood pressure carefully; contraindicated in uncontrolled hypertension.',
    ],
    description: 'Oral decongestant for sinus pressure and Eustachian tube blockages.',
  },
  {
    id: 'mucinex-dm',
    brandName: 'Mucinex DM',
    genericName: 'Guaifenesin / Dextromethorphan HBr',
    category: 'cold_flu',
    defaultStrength: '600mg / 30mg',
    unit: 'tablet',
    activeIngredients: [
      { name: 'Guaifenesin', amountMg: 600 },
      { name: 'Dextromethorphan', amountMg: 30 },
    ],
    maxDailyUnits: 4, // 4 * 600 = 2400mg Guaifenesin, 120mg DXM
    minDoseIntervalHours: 12,
    warnings: [
      '12-hour extended release tablet. Do not crush or chew.',
      'Do not exceed 4 tablets in 24 hours.',
    ],
    description: 'Expectorant and cough suppressant for chest congestion.',
  },
  {
    id: 'zyrtec-allergy',
    brandName: 'Zyrtec',
    genericName: 'Cetirizine HCl',
    category: 'allergy',
    defaultStrength: '10mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Cetirizine', amountMg: 10 }],
    maxDailyUnits: 1,
    minDoseIntervalHours: 24,
    warnings: ['Once-daily antihistamine. Do not take more than 10mg in 24 hours.'],
    description: '24-hour non-drowsy relief for indoor and outdoor allergies.',
  },
  {
    id: 'claritin-allergy',
    brandName: 'Claritin',
    genericName: 'Loratadine',
    category: 'allergy',
    defaultStrength: '10mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Loratadine', amountMg: 10 }],
    maxDailyUnits: 1,
    minDoseIntervalHours: 24,
    warnings: ['Do not exceed 1 tablet (10mg) per day.'],
    description: 'Non-drowsy 24-hour relief of seasonal rhinitis and hives.',
  },
  {
    id: 'lisinopril-rx',
    brandName: 'Prinivil / Zestril',
    genericName: 'Lisinopril',
    category: 'cardiovascular',
    defaultStrength: '10mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Lisinopril', amountMg: 10 }],
    maxDailyUnits: 4, // Max clinical dose 40mg
    minDoseIntervalHours: 12,
    warnings: ['Prescription ACE inhibitor. Take consistently once daily at the same time.'],
    description: 'First-line therapy for hypertension and heart failure management.',
  },
  {
    id: 'amoxicillin-rx',
    brandName: 'Amoxil',
    genericName: 'Amoxicillin',
    category: 'antibiotic',
    defaultStrength: '500mg',
    unit: 'capsule',
    activeIngredients: [{ name: 'Amoxicillin', amountMg: 500 }],
    maxDailyUnits: 3, // 3 * 500mg = 1,500mg/day
    minDoseIntervalHours: 8,
    warnings: [
      'Complete the entire prescribed antibiotic course even if feeling better.',
      'Space doses evenly every 8 hours.',
    ],
    description: 'Penicillin-class antibiotic for bacterial ear, sinus, throat, and chest infections.',
  },
  {
    id: 'metformin-rx',
    brandName: 'Glucophage',
    genericName: 'Metformin HCl',
    category: 'diabetes',
    defaultStrength: '500mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Metformin', amountMg: 500 }],
    maxDailyUnits: 4, // 2,000mg/day standard maintenance
    minDoseIntervalHours: 6,
    warnings: ['Take with meals to minimize gastrointestinal discomfort.'],
    description: 'First-line biguanide oral therapy for Type 2 diabetes glycemic control.',
  },
  {
    id: 'atorvastatin-rx',
    brandName: 'Lipitor',
    genericName: 'Atorvastatin Calcium',
    category: 'cardiovascular',
    defaultStrength: '20mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Atorvastatin', amountMg: 20 }],
    maxDailyUnits: 1,
    minDoseIntervalHours: 24,
    warnings: ['Take once daily, preferably in the evening. Report unexplained muscle soreness.'],
    description: 'Statin cholesterol reducer for cardiovascular risk reduction.',
  },
];

/**
 * Searches the medication database by brand, generic, or ingredient names.
 */
export function searchMedications(query: string): MedicationReference[] {
  const q = query.trim().toLowerCase();
  if (!q) return MEDICATION_DATABASE;

  return MEDICATION_DATABASE.filter((med) => {
    if (med.brandName.toLowerCase().includes(q)) return true;
    if (med.genericName.toLowerCase().includes(q)) return true;
    if (med.activeIngredients.some((i) => i.name.toLowerCase().includes(q))) return true;
    if (med.category.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Finds the closest medication record by name or keyword match.
 */
export function findBestMatch(name: string, _strength?: string): MedicationReference | null {
  const cleanName = name.toLowerCase().trim();
  if (!cleanName) return null;

  // Direct ID or exact brand match
  const exact = MEDICATION_DATABASE.find(
    (m) => m.id === cleanName || m.brandName.toLowerCase() === cleanName
  );
  if (exact) return exact;

  // Partial brand contains
  const brandMatch = MEDICATION_DATABASE.find((m) =>
    cleanName.includes(m.brandName.toLowerCase()) || m.brandName.toLowerCase().includes(cleanName)
  );
  if (brandMatch) return brandMatch;

  // Generic name match
  const genericMatch = MEDICATION_DATABASE.find((m) =>
    cleanName.includes(m.genericName.toLowerCase()) || m.genericName.toLowerCase().includes(cleanName)
  );
  if (genericMatch) return genericMatch;

  // Match by active ingredient
  const ingredientMatch = MEDICATION_DATABASE.find((m) =>
    m.activeIngredients.some((i) => cleanName.includes(i.name.toLowerCase()))
  );
  if (ingredientMatch) return ingredientMatch;

  return null;
}

/**
 * Automatically computes the daily pill limit given a medication record or ingredients.
 * Determines the strictest active ingredient constraint to calculate max safe doses per day.
 */
export function calculateAutomaticDailyLimit(config: {
  maxDailyUnits?: number;
  activeIngredients?: ActiveIngredient[];
  pillStrength?: string;
}): { maxDailyUnits: number; limitingIngredient?: string } {
  if (config.maxDailyUnits && config.maxDailyUnits > 0) {
    return { maxDailyUnits: config.maxDailyUnits };
  }

  if (!config.activeIngredients || config.activeIngredients.length === 0) {
    // Fallback default safe limit
    return { maxDailyUnits: 4 };
  }

  let strictestLimit = 8;
  let limitingIngredient: string | undefined = undefined;

  for (const ing of config.activeIngredients) {
    const key = normalizeIngredientName(ing.name);
    const limitMeta = INGREDIENT_DAILY_LIMITS[key];
    if (limitMeta && ing.amountMg > 0) {
      const allowedDoses = Math.floor(limitMeta.maxDailyMg / ing.amountMg);
      if (allowedDoses < strictestLimit) {
        strictestLimit = Math.max(1, allowedDoses);
        limitingIngredient = ing.name;
      }
    }
  }

  return { maxDailyUnits: strictestLimit, limitingIngredient };
}
