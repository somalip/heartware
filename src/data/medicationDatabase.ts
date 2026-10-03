import type { MedicationReference, ActiveIngredient } from '../types/index.ts';

export interface IngredientLimitInfo {
  maxDailyMg: number;
  clinicalCeilingMg?: number;
  description: string;
  criticalWarning: string;
  drugClass: 'analgesic' | 'nsaid' | 'antihistamine' | 'decongestant' | 'cough_suppressant' | 'expectorant' | 'antibiotic' | 'other';
  standardUnit: string;
  minIntervalHours: number;
  sourceAuthority: string;
  publicDatabase: string;
  monographCitation: string;
  referenceUrl: string;
  rxcui?: string;
  toxicologyRationale: string;
}

/**
 * Standard clinical safe daily maximum intake (in milligrams) for active ingredients.
 * Grounded in publicly verifiable government clinical monographs:
 * - U.S. Food & Drug Administration (FDA) OTC Drug Review (21 CFR Parts 341, 343)
 * - National Institutes of Health (NIH) DailyMed / U.S. National Library of Medicine (NLM)
 * - NLM RxNorm Clinical Drug Vocabulary
 * - United States Pharmacopeia (USP) Compendial Standards
 */
export const INGREDIENT_DAILY_LIMITS: Record<string, IngredientLimitInfo> = {
  acetaminophen: {
    maxDailyMg: 3000, // Conservative OTC ceiling (FDA maximum under medical supervision is 4,000mg; FDA 2011 safety advisory recommends 3,000-3,250mg for consumer OTC safety)
    clinicalCeilingMg: 4000,
    description: 'Pain reliever and fever reducer (APAP / Paracetamol)',
    criticalWarning: 'Exceeding 3,000 mg/day across all medications poses severe acute liver injury risk.',
    drugClass: 'analgesic',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA CDER & FDA Drug Safety Communication',
    publicDatabase: 'NIH DailyMed & openFDA Drug Review',
    monographCitation: 'FDA 21 CFR § 343.50; FDA Acetaminophen Prescription Dosing Guidance (Docket FDA-2011-N-0021)',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=42709e39-b9d9-4841-a675-8e7c10b7ea57',
    rxcui: '161',
    toxicologyRationale: 'Hepatotoxicity caused by accumulation of toxic metabolite N-acetyl-p-benzoquinone imine (NAPQI) when hepatic glutathione stores become depleted, leading to centrilobular liver necrosis.',
  },
  ibuprofen: {
    maxDailyMg: 1200, // Safe self-care OTC maximum (1,200mg/24h; clinician supervised prescription max 3,200mg/24h)
    clinicalCeilingMg: 3200,
    description: 'Nonsteroidal anti-inflammatory drug (NSAID)',
    criticalWarning: 'Excessive NSAID intake can cause gastrointestinal ulceration, internal bleeding, and kidney impairment.',
    drugClass: 'nsaid',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA Center for Drug Evaluation and Research (CDER)',
    publicDatabase: 'NIH DailyMed & openFDA OTC Directory',
    monographCitation: 'FDA 21 CFR § 343.10; FDA MedWatch NSAID Safety Alert (2015/2020)',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4da6e33f-2766-4148-ae01-f2f9b8c08ef3',
    rxcui: '5640',
    toxicologyRationale: 'Inhibition of cyclooxygenase-1 (COX-1) reduces mucosal cytoprotective prostaglandins, increasing risk of gastric perforation, bleeding, and diminished renal blood flow.',
  },
  naproxen: {
    maxDailyMg: 660, // Standard OTC max (220mg up to 3 times in 24 hours; Rx max 1,500mg)
    clinicalCeilingMg: 1500,
    description: 'Long-acting nonsteroidal anti-inflammatory drug (NSAID)',
    criticalWarning: 'Do not combine with Ibuprofen or other NSAIDs to avoid severe gastrointestinal and renal toxicity.',
    drugClass: 'nsaid',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 8,
    sourceAuthority: 'U.S. FDA CDER & USP Clinical Monograph',
    publicDatabase: 'NIH DailyMed / National Library of Medicine',
    monographCitation: 'FDA 21 CFR § 343.12; USP Compendial Standards for Naproxen Sodium',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e02bbbe7-4cf2-4d2b-9851-9efb5f3eb3bc',
    rxcui: '7258',
    toxicologyRationale: 'Long elimination half-life (12-17 hours) leads to persistent prostaglandin synthesis suppression; compounding with other NSAIDs drastically multiplies bleeding hazard.',
  },
  aspirin: {
    maxDailyMg: 4000,
    clinicalCeilingMg: 4000,
    description: 'Salicylate analgesic, antipyretic & antiplatelet agent',
    criticalWarning: 'High doses can lead to acute salicylate toxicity, metabolic acidosis, and gastrointestinal hemorrhage.',
    drugClass: 'nsaid',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA CDER Internal Analgesic Monograph',
    publicDatabase: 'NIH DailyMed & openFDA Drug Products',
    monographCitation: 'FDA 21 CFR § 343.50(b)(1); USP Compendial Aspirin Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=07faee26-e9b4-4e12-88f5-fa56e80b271d',
    rxcui: '1191',
    toxicologyRationale: 'Irreversible platelet cyclooxygenase acetylation causing prolonged hemostatic impairment and uncoupling of oxidative phosphorylation leading to hyperventilation and metabolic acidosis.',
  },
  diphenhydramine: {
    maxDailyMg: 300,
    clinicalCeilingMg: 300,
    description: 'First-generation ethanolamine sedating antihistamine',
    criticalWarning: 'Excessive intake causes extreme sedation, anticholinergic toxicity, cardiac arrhythmias, and delirium.',
    drugClass: 'antihistamine',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA OTC Cold, Cough, Allergy Monograph',
    publicDatabase: 'NIH DailyMed & openFDA API',
    monographCitation: 'FDA 21 CFR § 341.72; FDA Drug Safety Communication (Diphenhydramine abuse & toxicity warning)',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=937ea73f-5ce7-4933-9e48-8df050f28b4a',
    rxcui: '3498',
    toxicologyRationale: 'Central and peripheral muscarinic receptor antagonism (anticholinergic toxidrome): hyperthermia, mydriasis, urinary retention, ventricular arrhythmias (QT prolongation), and seizures.',
  },
  doxylamine: {
    maxDailyMg: 75,
    clinicalCeilingMg: 75,
    description: 'First-generation sedating antihistamine and nighttime sleep aid',
    criticalWarning: 'Strong sedative; avoid combining with other antihistamines, tranquilizers, or alcohol.',
    drugClass: 'antihistamine',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 6,
    sourceAuthority: 'U.S. FDA Nighttime Sleep-Aid Monograph',
    publicDatabase: 'NIH DailyMed / National Library of Medicine',
    monographCitation: 'FDA 21 CFR § 338.50; 21 CFR § 341.72',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a8ff24bb-e332-4467-96a9-e09211c4d9bc',
    rxcui: '3640',
    toxicologyRationale: 'Profound central nervous system depression with anticholinergic side effects; severe overdoses risk rhabdomyolysis and acute renal failure.',
  },
  dextromethorphan: {
    maxDailyMg: 120,
    clinicalCeilingMg: 120,
    description: 'Morphinan-derivative antitussive cough suppressant (DXM)',
    criticalWarning: 'Excessive doses cause serotonin syndrome, hallucinations, psychosis, and respiratory depression.',
    drugClass: 'cough_suppressant',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA OTC Antitussive Monograph',
    publicDatabase: 'NIH DailyMed & openFDA API',
    monographCitation: 'FDA 21 CFR § 341.74; USP Dextromethorphan Hydrobromide Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=769cece2-5813-4357-9db9-968e7ec8bf69',
    rxcui: '3289',
    toxicologyRationale: 'NMDA receptor antagonism and serotonin reuptake inhibition; in supratherapeutic doses produces dissociative states, hypertensive crisis, and fatal serotonin toxicity.',
  },
  phenylephrine: {
    maxDailyMg: 60,
    clinicalCeilingMg: 60,
    description: 'Selective alpha-1 adrenergic receptor agonist nasal decongestant',
    criticalWarning: 'Can cause severe hypertension, cardiac palpitations, cerebral hemorrhage, and reflex bradycardia.',
    drugClass: 'decongestant',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA OTC Cold/Cough Nasal Decongestant Monograph',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA 21 CFR § 341.80; FDA Advisory Committee Non-prescription Drugs Review',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a73fa1e4-e0b7-4c75-ba7e-7729f3d596ee',
    rxcui: '8163',
    toxicologyRationale: 'Peripheral vasoconstriction elevates total peripheral vascular resistance and systemic blood pressure, exacerbating ischemic heart disease and cerebrovascular risks.',
  },
  pseudoephedrine: {
    maxDailyMg: 240,
    clinicalCeilingMg: 240,
    description: 'Systemic sympathomimetic nasal and sinus decongestant',
    criticalWarning: 'Marked cardiovascular stimulant. Exceeding 240mg/day causes severe hypertensive crisis and tachyarrhythmia.',
    drugClass: 'decongestant',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA CDER & Combat Methamphetamine Epidemic Act / DEA',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA 21 CFR § 341.80; USP Pseudoephedrine Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=29a67472-8809-4171-aa31-e1293306dbb2',
    rxcui: '8814',
    toxicologyRationale: 'Releases endogenous norepinephrine and directly activates alpha and beta receptors, causing myocardial strain, coronary vasospasm, and neurological agitation.',
  },
  guaifenesin: {
    maxDailyMg: 2400,
    clinicalCeilingMg: 2400,
    description: 'Expectorant promoting respiratory tract fluid secretion and mucus clearance',
    criticalWarning: 'High intake can cause persistent nausea, emesis, and calcium oxalate nephrolithiasis.',
    drugClass: 'expectorant',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 4,
    sourceAuthority: 'U.S. FDA OTC Expectorant Monograph',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA 21 CFR § 341.78; USP Guaifenesin Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=93bafe59-c290-48e0-bbd8-4f81156821ce',
    rxcui: '5032',
    toxicologyRationale: 'Gastric mucosal irritation with severe emesis; excretion of high metabolite concentrations (beta-(2-methoxyphenoxy)lactic acid) increases renal calculus formation.',
  },
  cetirizine: {
    maxDailyMg: 10,
    clinicalCeilingMg: 10,
    description: 'Second-generation selective peripheral H1 receptor antagonist antihistamine',
    criticalWarning: 'Do not exceed 10mg in 24 hours unless explicitly supervised by an allergist or physician.',
    drugClass: 'antihistamine',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & NIH National Library of Medicine',
    publicDatabase: 'NIH DailyMed & openFDA API',
    monographCitation: 'FDA NDA 019835 / FDA OTC Monograph Review for Second-Gen Antihistamines',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6eb4bcba-eb07-4e00-a6e5-4f7db9ee15e8',
    rxcui: '20610',
    toxicologyRationale: 'Though peripherally selective with low blood-brain barrier penetration at therapeutic doses, supratherapeutic intake precipitates sedation, anticholinergic effects, and paradoxical excitation in pediatric patients.',
  },
  loratadine: {
    maxDailyMg: 10,
    clinicalCeilingMg: 10,
    description: 'Second-generation non-sedating tricyclic antihistamine',
    criticalWarning: 'Do not exceed 10mg in 24 hours.',
    drugClass: 'antihistamine',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & USP Compendial Standards',
    publicDatabase: 'NIH DailyMed & openFDA API',
    monographCitation: 'FDA NDA 019658; USP Loratadine Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1f6d9061-0062-4217-9c98-5775c92882c5',
    rxcui: '6470',
    toxicologyRationale: 'Overdose leads to tachycardia, headache, and somnolence without therapeutic benefit due to ceiling saturation of peripheral H1 receptors.',
  },
  fexofenadine: {
    maxDailyMg: 180,
    clinicalCeilingMg: 180,
    description: 'Second-generation peripherally selective H1 antihistamine',
    criticalWarning: 'Maximum 180mg in 24 hours. Take with water; avoid co-ingestion with fruit juices (grapefruit/apple/orange).',
    drugClass: 'antihistamine',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & NIH DailyMed',
    publicDatabase: 'NIH DailyMed & openFDA API',
    monographCitation: 'FDA NDA 020625; USP Fexofenadine Hydrochloride Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cc42ec34-31f0-466a-b286-302ffabf06ae',
    rxcui: '25480',
    toxicologyRationale: 'Substrate of intestinal OATP1A2 uptake transporters. Excessive doses cause dizziness, dry mouth, and drowsiness with diminished clearance in renal disease.',
  },
  amoxicillin: {
    maxDailyMg: 1500,
    clinicalCeilingMg: 3000,
    description: 'Moderate-spectrum aminopenicillin beta-lactam antibiotic',
    criticalWarning: 'Follow exact prescriber interval to maintain minimum inhibitory concentration (MIC); do not double-dose.',
    drugClass: 'antibiotic',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 8,
    sourceAuthority: 'U.S. FDA CDER & Clinical and Laboratory Standards Institute (CLSI)',
    publicDatabase: 'NIH DailyMed & openFDA Prescription Directory',
    monographCitation: 'FDA ANDA 062226; USP Amoxicillin Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=60946d0a-810a-42c6-9477-96a84c2049d5',
    rxcui: '723',
    toxicologyRationale: 'High cumulative doses induce gastrointestinal dysbiosis, risk of Clostridioides difficile colitis, and neurotoxicity / crystalluria in impaired renal clearance.',
  },
  lisinopril: {
    maxDailyMg: 40,
    clinicalCeilingMg: 80,
    description: 'Angiotensin-converting enzyme (ACE) inhibitor for cardiovascular & renal protection',
    criticalWarning: 'Exceeding prescribed dose may cause profound hypotension, acute renal shutdown, and fatal hyperkalemia.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 12,
    sourceAuthority: 'U.S. FDA CDER & American Heart Association (AHA/ACC)',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 019777; USP Lisinopril Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3b0ef18d-ef5d-4f10-bf92-75eb20d40248',
    rxcui: '29046',
    toxicologyRationale: 'Severe vasodilation precipitating circulatory collapse and acute kidney injury secondary to preferential dilation of the efferent renal arterioles.',
  },
  metformin: {
    maxDailyMg: 2550,
    clinicalCeilingMg: 2550,
    description: 'Biguanide oral antihyperglycemic agent for glycemic management',
    criticalWarning: 'Excessive intake carries risk of rare but life-threatening lactic acidosis and profound hypoglycemia when combined with secretagogues.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 6,
    sourceAuthority: 'U.S. FDA CDER & American Diabetes Association (ADA)',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 020357; USP Metformin Hydrochloride Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=29a00810-b996-4191-be61-07384ecdae01',
    rxcui: '6809',
    toxicologyRationale: 'Inhibition of mitochondrial respiratory chain complex I leads to increased anaerobic metabolism, pyruvate accumulation, and potentially lethal systemic lactic acidosis.',
  },
  atorvastatin: {
    maxDailyMg: 80,
    clinicalCeilingMg: 80,
    description: 'Synthetic HMG-CoA reductase inhibitor statin for dyslipidemia',
    criticalWarning: 'High doses can lead to severe rhabdomyolysis, myoglobinuria-induced renal failure, and elevated transaminases.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & National Lipid Association (NLA)',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 020702; USP Atorvastatin Calcium Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=247d8ffc-99c7-43f0-86cc-e70548d1c9ef',
    rxcui: '83367',
    toxicologyRationale: 'Disruption of ubiquinone (CoQ10) synthesis in skeletal muscle tissue triggering myopathy, severe creatine kinase elevation, and risk of acute tubular necrosis.',
  },
  sertraline: {
    maxDailyMg: 200,
    clinicalCeilingMg: 200,
    description: 'Selective serotonin reuptake inhibitor (SSRI) antidepressant',
    criticalWarning: 'Excessive doses or combining with MAOIs/triptans carries risk of life-threatening serotonin syndrome, hyperthermia, and seizures.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & APA Clinical Guidelines',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 019839; USP Sertraline Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a00e5720-d3a9-4629-9e85-78ea0ae7227d',
    rxcui: '36437',
    toxicologyRationale: 'Severe serotonergic hyperstimulation causing neuromuscular hyperactivity, autonomic instability, agitation, and cardiac arrhythmias.',
  },
  omeprazole: {
    maxDailyMg: 40,
    clinicalCeilingMg: 80,
    description: 'Proton pump inhibitor (PPI) for gastric acid reduction & GERD',
    criticalWarning: 'Long-term high doses risk hypomagnesemia, Clostridioides difficile infection, bone fractures, and impaired B12 absorption.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & ACG Guidelines',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 019810; USP Omeprazole Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fef36195-2dd8-410a-8bf7-106fa5139882',
    rxcui: '7646',
    toxicologyRationale: 'Profound hypochlorhydria, risk of interstitial nephritis, and drug interactions via CYP2C19 inhibition.',
  },
  gabapentin: {
    maxDailyMg: 2400,
    clinicalCeilingMg: 3600,
    description: 'GABA analogue anticonvulsant and neuropathic pain agent',
    criticalWarning: 'High doses carry risk of profound sedation, respiratory depression (especially with opioids), ataxia, and peripheral edema.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 8,
    sourceAuthority: 'U.S. FDA CDER & American Academy of Neurology',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 020235; USP Gabapentin Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6b7c468a-6b45-42cf-94f7-bf784b0f9f3c',
    rxcui: '25480',
    toxicologyRationale: 'Central nervous system depression, dizziness, somnolence, and risk of respiratory arrest when co-administered with CNS depressants.',
  },
  losartan: {
    maxDailyMg: 100,
    clinicalCeilingMg: 100,
    description: 'Angiotensin II receptor antagonist (ARB) for hypertension',
    criticalWarning: 'Exceeding recommended dose can cause severe hypotension, acute renal impairment, and dangerous hyperkalemia.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & AHA/ACC',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 020386; USP Losartan Potassium Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2ca8c909-0d17-48f8-a145-21d491cbeab1',
    rxcui: '52175',
    toxicologyRationale: 'Blockade of AT1 receptors leading to acute vasodilation, profound hypotension, reduced glomerular filtration, and potassium retention.',
  },
  levothyroxine: {
    maxDailyMg: 0.3,
    clinicalCeilingMg: 0.3,
    description: 'Synthetic crystalline L-3,3,5,5-tetraiodothyronine sodium (T4)',
    criticalWarning: 'Excessive doses induce thyrotoxic crisis, cardiac palpitations, tachyarrhythmias, angina, and accelerated bone demineralization.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & American Thyroid Association',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 021116; USP Levothyroxine Sodium Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5b7fc625-f935-433b-8260-ae93b6d4ee27',
    rxcui: '10582',
    toxicologyRationale: 'Hypermetabolic state, adrenergic receptor sensitization, left ventricular hypertrophy, and potentially fatal cardiac arrhythmias.',
  },
  amlodipine: {
    maxDailyMg: 10,
    clinicalCeilingMg: 10,
    description: 'Long-acting dihydropyridine calcium channel blocker for hypertension & angina',
    criticalWarning: 'Excessive doses precipitate profound peripheral vasodilation, reflex tachycardia, severe peripheral edema, and cardiogenic shock.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 24,
    sourceAuthority: 'U.S. FDA CDER & AHA/ACC',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 019787; USP Amlodipine Besylate Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b984556a-1bb0-4d37-8ff7-fa315f6087d0',
    rxcui: '17767',
    toxicologyRationale: 'Inhibition of L-type voltage-gated calcium channels in vascular smooth muscle and myocardium leading to refractory hypotension and bradycardia.',
  },
  metoprolol: {
    maxDailyMg: 200,
    clinicalCeilingMg: 400,
    description: 'Cardioselective beta-1 adrenergic receptor blocker',
    criticalWarning: 'Overdose leads to severe bradycardia, cardiogenic shock, high-degree AV heart block, bronchospasm, and hypoglycemia.',
    drugClass: 'other',
    standardUnit: 'mg / 24 hours',
    minIntervalHours: 12,
    sourceAuthority: 'U.S. FDA CDER & AHA/ACC',
    publicDatabase: 'NIH DailyMed & openFDA',
    monographCitation: 'FDA NDA 017963; USP Metoprolol Succinate Monograph',
    referenceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee97b9ec-b08e-49b0-9a3c-b17dbe989a5e',
    rxcui: '6918',
    toxicologyRationale: 'Profound reduction in cardiac output, chronotropic incompetence, negative dromotropy, and loss of beta-1 selectivity resulting in bronchoconstriction.',
  },
};

/**
 * Public clinical database provenance and calculation methodology details.
 * Displayed in the in-app Medication Safety & Clinical Limits Info Page.
 */
export const CLINICAL_DATABASE_PROVENANCE = {
  title: 'Heartware Open Medication Safety Reference Dataset',
  version: '2026.1 (Spring 2026 Revision)',
  lastReviewed: 'March 2026',
  publicSources: [
    {
      name: 'U.S. Food & Drug Administration (FDA) OTC Drug Review',
      authority: 'U.S. Department of Health and Human Services (HHS)',
      citation: 'Title 21 of the Code of Federal Regulations (21 CFR Parts 341, 343, 344)',
      publicAccessUrl: 'https://open.fda.gov/apis/drug/',
      description:
        'Official federal monographs setting binding over-the-counter maximum safe daily dosages, indications, active ingredient combinations, and toxicological label warnings.',
    },
    {
      name: 'NIH DailyMed (U.S. National Library of Medicine)',
      authority: 'National Institutes of Health (NIH)',
      citation: 'Structured Product Labeling (SPL) Database',
      publicAccessUrl: 'https://dailymed.nlm.nih.gov/dailymed/',
      description:
        'The gold-standard public repository of FDA-approved package inserts, clinical dosing ceiling recommendations, contraindications, and active ingredient milligram strengths.',
    },
    {
      name: 'National Library of Medicine (NLM) RxNorm',
      authority: 'U.S. National Library of Medicine',
      citation: 'Standard Clinical Drug Nomenclature & RxCUI Cross-Mapping',
      publicAccessUrl: 'https://www.nlm.nih.gov/research/umls/rxnorm/',
      description:
        'Provides normalized clinical drug ingredient identifiers (RxCUIs) to detect identical active substances regardless of proprietary consumer brand names.',
    },
    {
      name: 'United States Pharmacopeia (USP) Compendial Standards',
      authority: 'U.S. Pharmacopeial Convention',
      citation: 'USP-NF Standards Monographs',
      publicAccessUrl: 'https://www.usp.org/',
      description:
        'Independent scientific health authority standardizing medicinal ingredient purity, dissolution profiles, maximum therapeutic ceilings, and bioavailability parameters.',
    },
  ],
  calculationEngine: {
    step1_normalization:
      'Active Ingredient Normalization: Scanned or selected medications are parsed into standardized active molecules via RxNorm indexing (e.g., Tylenol, DayQuil, and NyQuil all resolve to Acetaminophen).',
    step2_unitLimit:
      'Unit Pill Limit Formula: For any single slot, the automatic daily dose cap is calculated as Math.floor(SafeDailyCeilingMg / PillIngredientMg) across all active ingredients.',
    step3_crossSlotAggregation:
      'Cross-Chamber Aggregation: The system monitors all 4 dispenser slots simultaneously. If Slot 1 and Slot 2 both contain the same active ingredient (e.g. DayQuil and Tylenol), intake is tracked cumulatively.',
    step4_rollingWindow:
      '24-Hour Rolling Window: Dosage tracking uses a continuous 24-hour lookback window (Date.now() - 24 hours), avoiding the dangerous "midnight reset" loophole where two full daily limits could otherwise be taken hours apart.',
    step5_preDispenseInterlock:
      'Pre-Dispense Hardware Safety Interlock: Before any motor or manual dispense actuates, the safety engine calculates: (Current 24h Milligrams + Candidate Dose Milligrams). If this would breach the public FDA safe limit, the dispenser locks and alerts the user.',
    step6_doseSpacing:
      'Minimum Dose Interval: Tracks minutes since last intake of each ingredient to enforce a minimum safe spacing (typically 4 to 6 hours for APAP and NSAIDs) preventing dangerous serum concentration spikes.',
  },
  disclaimer:
    'Clinical Disclaimer: Heartware safety limits are derived from public U.S. FDA federal monographs and NIH DailyMed clinical references for consumer harm-reduction and accidental duplicate active ingredient prevention. They are not a substitute for individualized clinical instructions from a licensed physician or pharmacist. Always prioritize prescription directions given by your healthcare provider.',
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
  if (lower.includes('sertraline') || lower.includes('zoloft')) return 'sertraline';
  if (lower.includes('omeprazole') || lower.includes('prilosec')) return 'omeprazole';
  if (lower.includes('gabapentin') || lower.includes('neurontin')) return 'gabapentin';
  if (lower.includes('losartan') || lower.includes('cozaar')) return 'losartan';
  if (lower.includes('levothyroxine') || lower.includes('synthroid')) return 'levothyroxine';
  if (lower.includes('amlodipine') || lower.includes('norvasc')) return 'amlodipine';
  if (lower.includes('metoprolol') || lower.includes('lopressor') || lower.includes('toprol')) return 'metoprolol';
  return lower;
}

/**
 * Comprehensive clinical medication reference catalog.
 */
export const MEDICATION_DATABASE: MedicationReference[] = [
  {
    id: 'dayquil-cold-flu',
    brandName: 'DayQuil Cold & Flu',
    aliases: ['dayquil', 'vicks dayquil', 'day-quil', 'day quil'],
    barcodes: ['023900014299', '323900014299', '302390014299'],
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
    aliases: ['nyquil', 'vicks nyquil', 'night-quil', 'ny-quil', 'nightquil'],
    barcodes: ['023900014305', '323900014305'],
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
    aliases: ['tylenol', 'tylenol extra', 'extra strength tylenol', 'tylenol 500', 'tylenol 500mg'],
    barcodes: ['300450449103', '030045044910', '0450449103'],
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
    aliases: ['tylenol regular', 'regular strength tylenol', 'tylenol 325', 'tylenol 325mg'],
    barcodes: ['300450444108', '030045044410'],
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
    aliases: ['excedrin', 'excedrin migraine', 'excedrin tension'],
    barcodes: ['300672000249', '030067200024'],
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
    aliases: ['advil', 'motrin', 'ibuprofen', 'advil liqui-gels', 'advil 200', 'advil 200mg', 'motrin ib'],
    barcodes: ['305730154203', '030573015420', '305730154401'],
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
    id: 'ibuprofen-rx',
    brandName: 'Ibuprofen (Watson / Rx)',
    aliases: [
      'ibuprofen 800mg',
      'ibuprofen 800',
      'ibuprofen 600mg',
      'ibuprofen 600',
      'ibuprofen 400mg',
      'watson ibuprofen',
      'mfg watson',
      'ibuprofen tab',
      'ibuprofen tablet',
      'ibuprofen 800mc',
      'ibuprofen 800 tablet',
      'ibuprofen rx',
    ],
    barcodes: ['336995032019', '0591040801', '00591040801'],
    genericName: 'Ibuprofen',
    category: 'nsaid',
    defaultStrength: '800mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Ibuprofen', amountMg: 800 }],
    maxDailyUnits: 4, // 4 * 800mg = 3,200mg max daily Rx ceiling
    minDoseIntervalHours: 6,
    warnings: [
      'Prescription strength NSAID. Take with food or milk to prevent GI upset.',
      'Maximum 4 tablets (3,200mg) per day. Do not exceed prescribed limit.',
      'Do not take with other NSAIDs (Advil, Aleve, Naproxen, Aspirin) due to severe gastric bleeding risk.',
    ],
    description: 'High-potency prescription anti-inflammatory for acute or chronic pain, arthritis, and swelling.',
  },
  {
    id: 'aleve-naproxen',
    brandName: 'Aleve',
    aliases: ['aleve', 'naproxen', 'naproxen sodium', 'aleve 220', 'aleve 220mg'],
    barcodes: ['02586658', '32586658', '002586658'],
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
    aliases: ['benadryl', 'diphenhydramine', 'benadryl 25', 'benadryl 25mg'],
    barcodes: ['312547171207', '031254717120'],
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
    aliases: ['sudafed', 'pseudoephedrine', 'sudafed 30', 'sudafed 30mg'],
    barcodes: ['300850020120', '030085002012'],
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
    aliases: ['mucinex', 'mucinex dm', 'guaifenesin dm', 'mucinex 600'],
    barcodes: ['363824023668', '036382402366'],
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
    aliases: ['zyrtec', 'cetirizine', 'zyrtec 10', 'zyrtec 10mg'],
    barcodes: ['300450204207', '030045020420'],
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
    aliases: ['claritin', 'loratadine', 'claritin 10', 'claritin 10mg'],
    barcodes: ['041100809643', '004110080964'],
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
    aliases: ['lisinopril', 'prinivil', 'zestril', 'lisinopril 10mg', 'lisinopril 20mg'],
    barcodes: ['00006001954', '00378031001'],
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
    aliases: ['amoxicillin', 'amoxil', 'amoxicillin 500mg', 'amoxicillin 250mg'],
    barcodes: ['00093310905', '00781261305'],
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
    aliases: ['metformin', 'glucophage', 'metformin 500mg', 'metformin 1000mg'],
    barcodes: ['00093104801', '00378001801'],
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
    aliases: ['atorvastatin', 'lipitor', 'atorvastatin 20mg', 'atorvastatin 40mg', 'atorvastatin 10mg'],
    barcodes: ['00071015523', '00093721298'],
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
  {
    id: 'sertraline-rx',
    brandName: 'Zoloft',
    aliases: ['sertraline', 'zoloft', 'sertraline hcl', 'sertraline 50mg', 'sertraline 100mg', 'sertraline 25mg'],
    barcodes: ['00049496030', '00049497030'],
    genericName: 'Sertraline HCl',
    category: 'other',
    defaultStrength: '50mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Sertraline', amountMg: 50 }],
    maxDailyUnits: 4, // Max 200mg/day
    minDoseIntervalHours: 24,
    warnings: ['Take consistently once daily with or without food. Do not stop abruptly.'],
    description: 'Selective serotonin reuptake inhibitor (SSRI) for depression and anxiety disorders.',
  },
  {
    id: 'omeprazole-rx',
    brandName: 'Prilosec',
    aliases: ['omeprazole', 'prilosec', 'omeprazole dr', 'omeprazole 20mg', 'omeprazole 40mg'],
    barcodes: ['00186074260', '00186074460'],
    genericName: 'Omeprazole Delayed-Release',
    category: 'other',
    defaultStrength: '20mg',
    unit: 'capsule',
    activeIngredients: [{ name: 'Omeprazole', amountMg: 20 }],
    maxDailyUnits: 2, // Max clinical 40mg
    minDoseIntervalHours: 24,
    warnings: ['Take 30 to 60 minutes before breakfast. Swallow whole; do not chew or crush.'],
    description: 'Proton pump inhibitor (PPI) for gastric reflux, heartburn, and erosive esophagitis.',
  },
  {
    id: 'gabapentin-rx',
    brandName: 'Neurontin',
    aliases: ['gabapentin', 'neurontin', 'gabapentin 300mg', 'gabapentin 600mg', 'gabapentin 100mg'],
    barcodes: ['00071080524', '00071080624'],
    genericName: 'Gabapentin',
    category: 'other',
    defaultStrength: '300mg',
    unit: 'capsule',
    activeIngredients: [{ name: 'Gabapentin', amountMg: 300 }],
    maxDailyUnits: 8, // Max 2,400mg/day
    minDoseIntervalHours: 8,
    warnings: ['May cause marked dizziness or somnolence. Space evenly three times daily.'],
    description: 'Anticonvulsant and neuropathic pain agent for peripheral neuropathy and postherpetic neuralgia.',
  },
  {
    id: 'losartan-rx',
    brandName: 'Cozaar',
    aliases: ['losartan', 'cozaar', 'losartan potassium', 'losartan 50mg', 'losartan 100mg', 'losartan 25mg'],
    barcodes: ['00006095154', '00006095254'],
    genericName: 'Losartan Potassium',
    category: 'cardiovascular',
    defaultStrength: '50mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Losartan', amountMg: 50 }],
    maxDailyUnits: 2, // Max 100mg/day
    minDoseIntervalHours: 24,
    warnings: ['Monitor blood pressure regularly. Avoid potassium supplements unless clinician directed.'],
    description: 'Angiotensin II receptor antagonist (ARB) for hypertension and diabetic nephropathy.',
  },
  {
    id: 'levothyroxine-rx',
    brandName: 'Synthroid',
    aliases: ['levothyroxine', 'synthroid', 'levothyroxine sodium', 'levothyroxine 50mcg', 'levoxyl'],
    barcodes: ['00074455219', '00074434119'],
    genericName: 'Levothyroxine Sodium',
    category: 'other',
    defaultStrength: '50mcg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Levothyroxine', amountMg: 0.05 }],
    maxDailyUnits: 1,
    minDoseIntervalHours: 24,
    warnings: ['Take first thing in the morning with a full glass of water, at least 30-60 minutes before breakfast.'],
    description: 'Synthetic thyroid hormone replacement for hypothyroidism.',
  },
  {
    id: 'amlodipine-rx',
    brandName: 'Norvasc',
    aliases: ['amlodipine', 'norvasc', 'amlodipine besylate', 'amlodipine 5mg', 'amlodipine 10mg'],
    barcodes: ['00069152068', '00069153068'],
    genericName: 'Amlodipine Besylate',
    category: 'cardiovascular',
    defaultStrength: '5mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Amlodipine', amountMg: 5 }],
    maxDailyUnits: 2, // Max 10mg/day
    minDoseIntervalHours: 24,
    warnings: ['Take once daily. Check for peripheral ankle swelling.'],
    description: 'Calcium channel blocker for hypertension and coronary artery disease.',
  },
  {
    id: 'metoprolol-rx',
    brandName: 'Lopressor / Toprol-XL',
    aliases: ['metoprolol', 'lopressor', 'toprol', 'toprol-xl', 'metoprolol succinate', 'metoprolol tartrate', 'metoprolol 25mg', 'metoprolol 50mg'],
    barcodes: ['00186109005', '00078045805'],
    genericName: 'Metoprolol Succinate / Tartrate',
    category: 'cardiovascular',
    defaultStrength: '50mg',
    unit: 'tablet',
    activeIngredients: [{ name: 'Metoprolol', amountMg: 50 }],
    maxDailyUnits: 4, // Max 200mg/day
    minDoseIntervalHours: 12,
    warnings: ['Beta-blocker. Do not discontinue abruptly; monitor resting heart rate.'],
    description: 'Cardioselective beta-blocker for hypertension, angina, and heart failure management.',
  },
];

/**
 * Searches the medication database by brand, generic, aliases, barcodes, or ingredient names.
 */
export function searchMedications(query: string): MedicationReference[] {
  const q = query.trim().toLowerCase();
  if (!q) return MEDICATION_DATABASE;

  return MEDICATION_DATABASE.filter((med) => {
    if (med.brandName.toLowerCase().includes(q)) return true;
    if (med.genericName.toLowerCase().includes(q)) return true;
    if (med.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    if (med.barcodes?.some((b) => b.includes(q))) return true;
    if (med.activeIngredients.some((i) => i.name.toLowerCase().includes(q))) return true;
    if (med.category.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Helper to escape regex special characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the closest medication record by name, barcode, or text keyword match.
 * Intelligently recognizes composite names, aliases, and prescription label lines.
 */
export function findBestMatch(name: string, strength?: string): MedicationReference | null {
  const rawClean = name.toLowerCase().trim();
  if (!rawClean) return null;

  // 1. Barcode check (direct match or string contains barcode)
  for (const m of MEDICATION_DATABASE) {
    if (m.barcodes) {
      for (const b of m.barcodes) {
        if (rawClean === b || rawClean.includes(b)) {
          return m;
        }
      }
    }
  }

  // 2. Direct ID or exact brand match
  const exact = MEDICATION_DATABASE.find(
    (m) => m.id === rawClean || m.brandName.toLowerCase() === rawClean
  );
  if (exact) return exact;

  // 3. Exact alias match
  const exactAlias = MEDICATION_DATABASE.find((m) =>
    m.aliases?.some((a) => a.toLowerCase() === rawClean)
  );
  if (exactAlias) return exactAlias;

  // Normalize string for word boundary checks
  const clean = rawClean.replace(/[^a-z0-9\s]/g, ' ');
  const is500orExtra = clean.includes('500') || clean.includes('extra');
  const is325orRegular = clean.includes('325') || clean.includes('regular');

  // 4. Specific brand / generic disambiguation
  if (clean.includes('dayquil')) {
    return MEDICATION_DATABASE.find((m) => m.id === 'dayquil-cold-flu') || null;
  }
  if (clean.includes('nyquil')) {
    return MEDICATION_DATABASE.find((m) => m.id === 'nyquil-cold-flu') || null;
  }
  if (
    clean.includes('advil') ||
    clean.includes('motrin') ||
    clean.includes('ibuprofen') ||
    clean.includes('mfg watson') ||
    clean.includes('buprofen')
  ) {
    const isHighStrengthRx =
      clean.includes('800') ||
      clean.includes('600') ||
      clean.includes('400') ||
      clean.includes('watson') ||
      clean.includes('rx') ||
      (strength && (strength.includes('800') || strength.includes('600') || strength.includes('400')));
    if (isHighStrengthRx) {
      return MEDICATION_DATABASE.find((m) => m.id === 'ibuprofen-rx') || null;
    }
    return MEDICATION_DATABASE.find((m) => m.id === 'advil-ibuprofen') || null;
  }
  if (clean.includes('aleve') || clean.includes('naproxen')) {
    return MEDICATION_DATABASE.find((m) => m.id === 'aleve-naproxen') || null;
  }

  // Tylenol / Acetaminophen disambiguation
  if (clean.includes('tylenol') || clean.includes('acetaminophen') || clean.includes('paracetamol')) {
    if (is500orExtra || clean.includes('500') || strength?.includes('500')) {
      return MEDICATION_DATABASE.find((m) => m.id === 'tylenol-extra-strength') || null;
    }
    if (is325orRegular || clean.includes('325') || strength?.includes('325')) {
      return MEDICATION_DATABASE.find((m) => m.id === 'tylenol-regular-strength') || null;
    }
    return MEDICATION_DATABASE.find((m) => m.id === 'tylenol-extra-strength') || null;
  }

  // 5. Word boundary / Token alias check across catalog
  for (const m of MEDICATION_DATABASE) {
    // Check aliases
    if (m.aliases) {
      for (const alias of m.aliases) {
        const escaped = escapeRegex(alias.toLowerCase());
        const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
        if (regex.test(clean)) {
          return m;
        }
      }
    }

    // Split brand name by slashes or hyphens (e.g. "Advil / Motrin" -> ["Advil", "Motrin"])
    const brandTokens = m.brandName
      .split(/[\/\-]/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 3);

    for (const token of brandTokens) {
      const escaped = escapeRegex(token);
      const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
      if (regex.test(clean)) {
        return m;
      }
    }
  }

  // 6. Generic name match
  for (const m of MEDICATION_DATABASE) {
    const genericParts = m.genericName
      .split(/[\/\(\)]/)
      .map((g) => g.trim().toLowerCase())
      .filter((g) => g.length >= 4);

    for (const part of genericParts) {
      const escaped = escapeRegex(part);
      const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
      if (regex.test(clean)) {
        return m;
      }
    }
  }

  // 7. Active ingredient match (prefer single-entity and matching strength)
  let bestIngredientCandidate: MedicationReference | null = null;
  for (const m of MEDICATION_DATABASE) {
    for (const ing of m.activeIngredients) {
      const ingName = ing.name.toLowerCase();
      if (ingName.length >= 4) {
        const escaped = escapeRegex(ingName);
        const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
        if (regex.test(clean)) {
          // If strength matches this ingredient's amount, it's a direct hit
          if (strength) {
            const numStr = strength.replace(/[^0-9.]/g, '');
            if (numStr && ing.amountMg.toString() === numStr) {
              return m;
            }
          }
          if (!bestIngredientCandidate) {
            bestIngredientCandidate = m;
          }
        }
      }
    }
  }
  if (bestIngredientCandidate) return bestIngredientCandidate;

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
  if (config.maxDailyUnits && config.maxDailyUnits > 0 && !config.pillStrength) {
    return { maxDailyUnits: config.maxDailyUnits };
  }

  if (!config.activeIngredients || config.activeIngredients.length === 0) {
    return { maxDailyUnits: config.maxDailyUnits || 4 };
  }

  // Parse milligrams from pillStrength if provided
  let strengthMg: number | null = null;
  if (config.pillStrength) {
    const m = config.pillStrength.match(/^(\d+(?:\.\d+)?)\s*(?:mg|g|mcg)?$/i);
    if (m) {
      strengthMg = parseFloat(m[1]);
      if (config.pillStrength.toLowerCase().includes('mcg')) {
        strengthMg = strengthMg / 1000;
      } else if (config.pillStrength.toLowerCase().includes('g') && !config.pillStrength.toLowerCase().includes('mg')) {
        strengthMg = strengthMg * 1000;
      }
    }
  }

  let strictestLimit = config.maxDailyUnits || 8;
  let limitingIngredient: string | undefined = undefined;

  for (const ing of config.activeIngredients) {
    const key = normalizeIngredientName(ing.name);
    const limitMeta = INGREDIENT_DAILY_LIMITS[key];
    const effectiveMg = (config.activeIngredients.length === 1 && strengthMg && strengthMg > 0) ? strengthMg : ing.amountMg;
    if (limitMeta && effectiveMg > 0) {
      // Determine if single dose indicates prescription strength (e.g. Ibuprofen >= 400mg, Naproxen > 250mg)
      const isPrescriptionDose =
        (key === 'ibuprofen' && effectiveMg >= 400) ||
        (key === 'naproxen' && effectiveMg > 250) ||
        effectiveMg > limitMeta.maxDailyMg;

      const ceilingMg =
        isPrescriptionDose && limitMeta.clinicalCeilingMg
          ? limitMeta.clinicalCeilingMg
          : limitMeta.maxDailyMg;
      const allowedDoses = Math.floor(ceilingMg / effectiveMg);
      if (allowedDoses < strictestLimit) {
        strictestLimit = Math.max(1, allowedDoses);
        limitingIngredient = ing.name;
      }
    }
  }

  return { maxDailyUnits: strictestLimit, limitingIngredient };
}
