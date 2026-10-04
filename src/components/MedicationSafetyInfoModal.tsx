import React, { useState, useMemo } from 'react';
import { IosSheet } from './IosSheet';
import { IosSegmentedControl } from './IosSegmentedControl';
import {
  INGREDIENT_DAILY_LIMITS,
  CLINICAL_DATABASE_PROVENANCE,
} from '../data/medicationDatabase';
import { triggerHaptic } from '../utils/haptics';
import { BuildingIcon, SearchIcon, XIcon } from './Icons';

interface Props {
  onClose: () => void;
  initialTab?: 'formulas' | 'sources' | 'catalog';
}

const TABS = [
  { value: 'formulas', label: 'How It\'s Calculated' },
  { value: 'sources', label: 'Public Databases' },
  { value: 'catalog', label: 'Clinical Limits' },
] as const;

type TabKey = (typeof TABS)[number]['value'];

export const MedicationSafetyInfoModal: React.FC<Props> = ({
  onClose,
  initialTab = 'formulas',
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const filteredIngredients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return Object.entries(INGREDIENT_DAILY_LIMITS).filter(([key, info]) => {
      const matchesQuery =
        !q ||
        key.includes(q) ||
        info.description.toLowerCase().includes(q) ||
        info.drugClass.toLowerCase().includes(q) ||
        info.monographCitation.toLowerCase().includes(q);

      const matchesClass =
        selectedClass === 'all' || info.drugClass === selectedClass;

      return matchesQuery && matchesClass;
    });
  }, [searchQuery, selectedClass]);

  return (
    <IosSheet
      title="Medication Safety & Limits"
      leftActionText="Done"
      onLeftAction={onClose}
      onClose={onClose}
    >
      <div className="ios-safety-info-container" style={{ padding: '0 16px 24px' }}>
        {/* Subtitle / Source Banner */}
        <div
          style={{
            background: 'var(--ios-fill)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            lineHeight: 1.45,
            color: 'var(--ios-secondary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              color: 'var(--ios-label)',
              marginBottom: '4px',
              fontSize: '14px',
            }}
          >
            <BuildingIcon size={16} color="var(--ios-label)" />
            <span>Reliable & Public Clinical Data Sources</span>
          </div>
          Heartware dosage ceilings and drug interaction thresholds are sourced
          exclusively from public, peer-reviewed federal and health authority
          monographs from the <strong>U.S. FDA</strong>,{' '}
          <strong>NIH DailyMed</strong>, <strong>NLM RxNorm</strong>, and{' '}
          <strong>USP</strong>.
        </div>

        {/* Tab Selector */}
        <IosSegmentedControl
          options={TABS}
          value={activeTab}
          onChange={(newVal) => {
            triggerHaptic('selection');
            setActiveTab(newVal as TabKey);
          }}
        />

        {/* TAB 1: HOW IT'S CALCULATED */}
        {activeTab === 'formulas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            {/* Lead Intro */}
            <div style={{ fontSize: '13px', color: 'var(--ios-secondary)', lineHeight: 1.5 }}>
              Heartware continuously evaluates active pharmaceutical ingredients across all four
              dispenser chambers to prevent multi-medication toxicity and cumulative overdose.
              Here is how each calculation is performed:
            </div>

            {/* Step 1: Unit Pill Limit */}
            <div className="ios-formula-card">
              <div className="ios-formula-header">
                <span className="ios-formula-step">1</span>
                <span className="ios-formula-title">Unit Pill Limit Formula</span>
              </div>
              <div className="ios-formula-body">
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  For each configured chamber or scanned prescription, the automatic daily dose cap is calculated by dividing the ingredient safe daily limit by the amount in each unit:
                </p>
                <div className="ios-formula-box">
                  <code>
                    Max Daily Units = min( ⌊ Safe Daily Ceiling (mg) / Amount per Unit (mg) ⌋ )
                  </code>
                </div>
                <div className="ios-formula-example">
                  <strong>Clinical Example:</strong> Extra Strength Tylenol contains 500&nbsp;mg Acetaminophen.
                  The safe public OTC limit is 3,000&nbsp;mg/day.
                  <br />
                  <code>⌊ 3,000&nbsp;mg / 500&nbsp;mg ⌋ = 6 caplets maximum per 24 hours.</code>
                </div>
              </div>
            </div>

            {/* Step 2: Cross-Chamber Multi-Medication Aggregation */}
            <div className="ios-formula-card">
              <div className="ios-formula-header">
                <span className="ios-formula-step">2</span>
                <span className="ios-formula-title">Cross-Chamber Ingredient Aggregation</span>
              </div>
              <div className="ios-formula-body">
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  Unlike conventional pill organizers that treat each bottle in isolation, Heartware standardizes active ingredients using NIH RxNorm to monitor cross-intake:
                </p>
                <div className="ios-formula-box">
                  <code>
                    Total Intake(ingredient) = ∑ (Chamber_k Intake in 24h)
                  </code>
                </div>
                <div className="ios-formula-example">
                  <strong>Cross-Intake Example:</strong> Slot 1 has DayQuil (325&nbsp;mg APAP) and Slot 2 has Tylenol (500&nbsp;mg APAP). If you take 4 DayQuil (1,300&nbsp;mg) and 4 Tylenol (2,000&nbsp;mg), your cumulative APAP is 3,300&nbsp;mg — exceeding the safe 3,000&nbsp;mg limit even though neither individual pill hit its single-bottle limit!
                </div>
              </div>
            </div>

            {/* Step 3: Rolling 24-Hour Lookback Window */}
            <div className="ios-formula-card">
              <div className="ios-formula-header">
                <span className="ios-formula-step">3</span>
                <span className="ios-formula-title">Continuous 24-Hour Rolling Window</span>
              </div>
              <div className="ios-formula-body">
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  Traditional trackers use a calendar day that resets at midnight (00:00). This creates a dangerous loophole where a user could take maximum doses at 11:30 PM and again at 12:30 AM. Heartware eliminates this hazard with a sliding 24-hour window:
                </p>
                <div className="ios-formula-box">
                  <code>
                    Lookback Period = [ Current Time - 24 Hours, Current Time ]
                  </code>
                </div>
                <div className="ios-formula-example">
                  Only doses dispensed within the preceding 1,440 minutes count toward the current cumulative active total.
                </div>
              </div>
            </div>

            {/* Step 4: Pre-Dispense Interlock */}
            <div className="ios-formula-card">
              <div className="ios-formula-header">
                <span className="ios-formula-step">4</span>
                <span className="ios-formula-title">Pre-Dispense Hardware Safety Interlock</span>
              </div>
              <div className="ios-formula-body">
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  Before any servo actuation or manual dispense occurs, the app and BLE firmware simulate the impending dose:
                </p>
                <div className="ios-formula-box">
                  <code>
                    Projected Intake = (Current 24h Intake) + (Next Dose Intake)
                  </code>
                </div>
                <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  <li><strong>Projected &gt; 100% of Limit:</strong> Dispenser is HARD-LOCKED. High-severity alert modal triggered to protect liver/kidneys.</li>
                  <li><strong>Projected ≥ 75% of Limit:</strong> Warning state activated; caution message displayed.</li>
                  <li><strong>Projected &lt; 75% of Limit:</strong> Normal safe dispense permitted.</li>
                </ul>
              </div>
            </div>

            {/* Step 5: Minimum Dosing Interval */}
            <div className="ios-formula-card">
              <div className="ios-formula-header">
                <span className="ios-formula-step">5</span>
                <span className="ios-formula-title">Minimum Dosing Interval Protection</span>
              </div>
              <div className="ios-formula-body">
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ios-secondary)' }}>
                  Drugs require time for hepatic and renal clearance. To prevent high serum peak spikes:
                </p>
                <div className="ios-formula-box">
                  <code>
                    Safe Interval Check = (Now - Last Dispensed Timestamp) ≥ Min Interval (hrs)
                  </code>
                </div>
                <div className="ios-formula-example">
                  Acetaminophen and Ibuprofen require at least <strong>4 hours</strong> between administrations; extended-release formulations (e.g. Mucinex DM, Naproxen) require <strong>8 to 12 hours</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PUBLIC & RELIABLE DATABASES */}
        {activeTab === 'sources' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <div style={{ fontSize: '13px', color: 'var(--ios-secondary)', lineHeight: 1.5 }}>
              All dosage parameters in Heartware are derived strictly from publicly available government and medical authority repositories. No proprietary algorithms or paywalled databases are used.
            </div>

            {CLINICAL_DATABASE_PROVENANCE.publicSources.map((source, i) => (
              <div key={i} className="ios-source-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ios-label)' }}>
                    {source.name}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--ios-label)', fontWeight: 500, marginBottom: '6px' }}>
                  {source.authority} · {source.citation}
                </div>

                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--ios-secondary)', lineHeight: 1.4 }}>
                  {source.description}
                </p>

                <a
                  href={source.publicAccessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ios-source-link"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: 'var(--ios-label)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  <span>Open Public Monograph Database</span>
                  <span>↗</span>
                </a>
              </div>
            ))}

            <div
              style={{
                background: 'var(--ios-card)',
                border: '0.5px solid var(--ios-separator)',
                borderRadius: '12px',
                padding: '14px',
                marginTop: '6px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ios-label)', marginBottom: '4px' }}>
                Open Standards Transparency
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ios-secondary)', lineHeight: 1.4 }}>
                Heartware conforms to the U.S. National Library of Medicine (NLM) RxNorm clinical ontology. You can independently verify any active ingredient's standard adult limit through openFDA and NIH DailyMed using the public RxCUI codes listed in our reference catalog.
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INGREDIENT REFERENCE DIRECTORY */}
        {activeTab === 'catalog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                className="ios-input"
                style={{
                  background: 'var(--ios-fill)',
                  borderRadius: '10px',
                  padding: '8px 12px 8px 34px',
                  fontSize: '14px',
                }}
                placeholder="Search active ingredient (e.g. APAP, Ibuprofen)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ios-tertiary)',
                  fontSize: '14px',
                  pointerEvents: 'none',
                }}
              >
                  <SearchIcon size={16} color="var(--ios-tertiary)" />
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--ios-tertiary)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <XIcon size={14} color="var(--ios-tertiary)" />
                </button>
              )}
            </div>

            {/* Quick Drug Class Pills */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {['all', 'analgesic', 'nsaid', 'antihistamine', 'decongestant', 'cough_suppressant', 'expectorant'].map(
                (cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedClass(cls);
                    }}
                    style={{
                      border: 'none',
                      borderRadius: '14px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: selectedClass === cls ? 600 : 400,
                      background: selectedClass === cls ? 'var(--ios-label)' : 'var(--ios-fill)',
                      color: selectedClass === cls ? 'var(--ios-bg)' : 'var(--ios-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      textTransform: cls === 'nsaid' ? 'uppercase' : 'capitalize',
                    }}
                  >
                    {cls.replace('_', ' ')}
                  </button>
                )
              )}
            </div>

            {/* Filtered List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredIngredients.map(([key, item]) => {
                const displayName = key.charAt(0).toUpperCase() + key.slice(1);
                return (
                  <div
                    key={key}
                    style={{
                      background: 'var(--ios-card)',
                      border: '0.5px solid var(--ios-separator)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ios-label)' }}>
                          {displayName}
                        </span>
                        {item.rxcui && (
                          <span style={{ fontSize: '11px', color: 'var(--ios-tertiary)', marginLeft: '6px' }}>
                            RxCUI: {item.rxcui}
                          </span>
                        )}
                      </div>
                      <span className="ios-badge blue" style={{ fontSize: '11px' }}>
                        Max {item.maxDailyMg} {item.standardUnit}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--ios-secondary)', marginBottom: '8px' }}>
                      {item.description}
                    </div>

                    <div
                      style={{
                        background: 'rgba(255, 59, 48, 0.08)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        color: 'var(--ios-red)',
                        marginBottom: '8px',
                        lineHeight: 1.35,
                      }}
                    >
                      <strong>Toxicology Warning:</strong> {item.criticalWarning}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--ios-tertiary)', marginBottom: '8px', lineHeight: 1.4 }}>
                      <strong>Clinical Mechanism:</strong> {item.toxicologyRationale}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '0.5px solid var(--ios-separator)',
                        paddingTop: '8px',
                        fontSize: '11px',
                        color: 'var(--ios-secondary)',
                      }}
                    >
                      <span>
                        Min interval: <strong>{item.minIntervalHours} hrs</strong> · Citation:{' '}
                        {item.monographCitation.split(';')[0]}
                      </span>
                      <a
                        href={item.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--ios-label)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        NIH Monograph ↗
                      </a>
                    </div>
                  </div>
                );
              })}

              {filteredIngredients.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--ios-tertiary)', fontSize: '14px' }}>
                  No active ingredients matching "{searchQuery}".
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global Clinical & Legal Disclaimer */}
        <div
          style={{
            marginTop: '20px',
            borderTop: '0.5px solid var(--ios-separator)',
            paddingTop: '14px',
            fontSize: '11px',
            color: 'var(--ios-tertiary)',
            lineHeight: 1.4,
          }}
        >
          <strong>Medical Notice:</strong> Safe dosage calculations are automated safeguards derived from U.S. FDA 21 CFR regulations and NIH DailyMed clinical labeling. Individual patient tolerances vary with body mass, renal/hepatic function, age, and pregnancy. Always consult your prescribing physician or clinical pharmacist for tailored medical directions.
        </div>
      </div>
    </IosSheet>
  );
};
