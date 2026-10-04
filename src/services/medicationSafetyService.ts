import {
  ChamberConfig,
  DispenseLog,
  CrossIntakeConflict,
  IngredientIntakeProgress,
  DispenseSafetyEvaluation,
} from '../types';
import {
  INGREDIENT_DAILY_LIMITS,
  normalizeIngredientName,
  findBestMatch,
} from '../data/medicationDatabase';

export const medicationSafetyService = {
  /**
   * Scans all dispenser chambers to find shared active ingredients or drug class duplication.
   * Example: DayQuil in Slot 1 and Tylenol in Slot 2 both contain Acetaminophen.
   */
  checkChamberConflicts(chambers: ChamberConfig[]): CrossIntakeConflict[] {
    const conflicts: CrossIntakeConflict[] = [];
    const ingredientMap: Record<
      string,
      { servoId: 1 | 2 | 3 | 4; medicationName: string; amountMg: number }[]
    > = {};

    const configured = chambers.filter((c) => c.medicationName.trim().length > 0);

    for (const c of configured) {
      // Resolve active ingredients from chamber or fallback database match
      let ingredients = c.activeIngredients;
      if (!ingredients || ingredients.length === 0) {
        const match = findBestMatch(c.medicationName);
        if (match) ingredients = match.activeIngredients;
      }

      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) {
          const key = normalizeIngredientName(ing.name);
          if (!ingredientMap[key]) {
            ingredientMap[key] = [];
          }
          ingredientMap[key].push({
            servoId: c.servoId,
            medicationName: c.medicationName,
            amountMg: ing.amountMg,
          });
        }
      }
    }

    for (const [key, slots] of Object.entries(ingredientMap)) {
      if (slots.length > 1) {
        const limitMeta = INGREDIENT_DAILY_LIMITS[key];
        const displayName = slots[0].medicationName ? key.charAt(0).toUpperCase() + key.slice(1) : key;
        const safeLimit = limitMeta ? limitMeta.maxDailyMg : 3000;
        const slotNames = slots.map((s) => `Slot ${s.servoId} (${s.medicationName})`).join(' and ');

        conflicts.push({
          ingredientName: displayName,
          chambersInvolved: slots,
          severity: key === 'acetaminophen' || key === 'ibuprofen' || key === 'naproxen' ? 'high' : 'medium',
          message: `${slotNames} both contain ${displayName}. Taking doses from both slots could easily exceed the safe ${safeLimit}mg daily limit.`,
          safeLimitMg: safeLimit,
        });
      }
    }

    return conflicts;
  },

  /**
   * Calculates rolling 24-hour intake of active ingredients across all dispenser chambers.
   */
  calculateDailyIntake(
    logs: DispenseLog[],
    chambers: ChamberConfig[],
    hoursWindow = 24
  ): IngredientIntakeProgress[] {
    const configuredChambers = chambers.filter((c) => c.medicationName.trim().length > 0);
    if (configuredChambers.length === 0) {
      return [];
    }

    const cutoff = Date.now() - hoursWindow * 60 * 60 * 1000;
    const recentLogs = logs.filter(
      (l) => l.status === 'success' && new Date(l.timestamp).getTime() >= cutoff
    );

    const intakeMap: Record<
      string,
      {
        totalMg: number;
        slots: Record<
          number,
          { servoId: 1 | 2 | 3 | 4; medicationName: string; amountMg: number; doseCount: number }
        >;
      }
    > = {};

    for (const log of recentLogs) {
      const chamber = log.chamberId ? chambers.find((c) => c.servoId === log.chamberId) : undefined;

      let ingredients = log.activeIngredients || chamber?.activeIngredients;

      if (!ingredients || ingredients.length === 0) {
        const match = findBestMatch(log.medicationName);
        if (match) ingredients = match.activeIngredients;
      }

      if (ingredients && ingredients.length > 0) {
        const pills = log.pillsDispensed || 1;
        for (const ing of ingredients) {
          const key = normalizeIngredientName(ing.name);
          if (!intakeMap[key]) {
            intakeMap[key] = { totalMg: 0, slots: {} };
          }
          const doseMg = ing.amountMg * pills;
          intakeMap[key].totalMg += doseMg;

          const slotKey = log.chamberId || 0;
          if (!intakeMap[key].slots[slotKey]) {
            intakeMap[key].slots[slotKey] = {
              servoId: (log.chamberId || 1) as 1 | 2 | 3 | 4,
              medicationName: log.medicationName,
              amountMg: 0,
              doseCount: 0,
            };
          }
          intakeMap[key].slots[slotKey].amountMg += doseMg;
          intakeMap[key].slots[slotKey].doseCount += pills;
        }
      }
    }

    const results: IngredientIntakeProgress[] = [];

    for (const [key, data] of Object.entries(intakeMap)) {
      const limitMeta = INGREDIENT_DAILY_LIMITS[key];
      const maxMg = limitMeta ? limitMeta.maxDailyMg : 3000;
      const percent = Math.min(100, Math.round((data.totalMg / maxMg) * 100));
      const status: 'safe' | 'warning' | 'exceeded' =
        data.totalMg >= maxMg ? 'exceeded' : percent >= 75 ? 'warning' : 'safe';

      const displayName = key.charAt(0).toUpperCase() + key.slice(1);

      results.push({
        ingredientName: displayName,
        takenTodayMg: data.totalMg,
        maxDailyMg: maxMg,
        percent,
        status,
        slotsContributing: Object.values(data.slots),
      });
    }

    return results.sort((a, b) => b.percent - a.percent);
  },

  /**
   * Returns how many pills have been dispensed from a specific chamber in the last 24 hours.
   */
  getSlotDailyDoseCount(servoId: number, logs: DispenseLog[], hoursWindow = 24): number {
    const cutoff = Date.now() - hoursWindow * 60 * 60 * 1000;
    return logs
      .filter(
        (l) => l.chamberId === servoId && l.status === 'success' && new Date(l.timestamp).getTime() >= cutoff
      )
      .reduce((sum, l) => sum + (l.pillsDispensed || 1), 0);
  },

  /**
   * Pre-dispense safety check: validates cumulative intake and dose intervals.
   */
  validateDispenseSafety(
    targetServoId: 1 | 2 | 3 | 4,
    chambers: ChamberConfig[],
    logs: DispenseLog[],
    pillCount: number = 1
  ): DispenseSafetyEvaluation {
    const chamber = chambers.find((c) => c.servoId === targetServoId);
    if (!chamber) {
      return { safeToDispense: false, hardBlocked: true, warnings: ['Chamber not found'] };
    }

    const requestedCount = Math.max(1, pillCount);
    const warnings: string[] = [];
    let hardBlocked = false;
    let blockReason: string | undefined = undefined;
    let exceededIngredient: DispenseSafetyEvaluation['exceededIngredient'] = undefined;
    let recentDoseIntervalViolation: DispenseSafetyEvaluation['recentDoseIntervalViolation'] = undefined;

    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter(
      (l) => l.status === 'success' && new Date(l.timestamp).getTime() >= cutoff24h
    );

    // 1. Check Chamber Max Daily Doses
    const dosesToday = recentLogs
      .filter((l) => l.chamberId === targetServoId)
      .reduce((sum, l) => sum + (l.pillsDispensed || 1), 0);

    if (chamber.maxDailyDoses && chamber.maxDailyDoses > 0) {
      if (dosesToday + requestedCount > chamber.maxDailyDoses) {
        hardBlocked = true;
        blockReason = `Daily limit exceeded for Slot ${targetServoId} (${chamber.medicationName}). You have already dispensed ${dosesToday} of ${chamber.maxDailyDoses} allowed pills today. Dispensing ${requestedCount} more would exceed the limit.`;
        warnings.push(blockReason);
      }
    }

    // 2. Check Cumulative Active Ingredient Overdose across ALL slots
    let ingredients = chamber.activeIngredients;
    if (!ingredients || ingredients.length === 0) {
      const match = findBestMatch(chamber.medicationName);
      if (match) ingredients = match.activeIngredients;
    }

    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        const key = normalizeIngredientName(ing.name);
        const limitMeta = INGREDIENT_DAILY_LIMITS[key];
        if (!limitMeta) continue;

        // Sum milligrams of this ingredient across ANY slot in the last 24h
        let currentTotalMg = 0;
        for (const log of recentLogs) {
          const logChamber = chambers.find((c) => c.servoId === log.chamberId);
          let logIngredients = log.activeIngredients || logChamber?.activeIngredients;
          if (!logIngredients || logIngredients.length === 0) {
            const m = findBestMatch(log.medicationName);
            if (m) logIngredients = m.activeIngredients;
          }
          if (logIngredients) {
            const matchingIng = logIngredients.find((i) => normalizeIngredientName(i.name) === key);
            if (matchingIng) {
              const pills = log.pillsDispensed || 1;
              currentTotalMg += matchingIng.amountMg * pills;
            }
          }
        }

        const additionalMg = ing.amountMg * requestedCount;
        const wouldBeMg = currentTotalMg + additionalMg;
        if (wouldBeMg > limitMeta.maxDailyMg) {
          hardBlocked = true;
          exceededIngredient = {
            name: ing.name,
            currentMg: currentTotalMg,
            wouldBeMg,
            maxMg: limitMeta.maxDailyMg,
          };
          blockReason = `Cross-intake risk! Dispensing ${requestedCount} pill${requestedCount > 1 ? 's' : ''} of ${chamber.medicationName} would bring your 24-hour ${ing.name} intake to ${wouldBeMg}mg, which exceeds the safe limit of ${limitMeta.maxDailyMg}mg.`;
          warnings.push(blockReason);
        } else if (wouldBeMg >= limitMeta.maxDailyMg * 0.8) {
          warnings.push(
            `Approaching maximum daily limit for ${ing.name}: this dose brings you to ${wouldBeMg}mg / ${limitMeta.maxDailyMg}mg (${Math.round((wouldBeMg / limitMeta.maxDailyMg) * 100)}%).`
          );
        }

        // 3. Check Minimum Safe Dose Interval (e.g. 4 hours)
        const minIntervalHours = key === 'acetaminophen' || key === 'ibuprofen' ? 4 : 4;
        const intervalCutoff = Date.now() - minIntervalHours * 60 * 60 * 1000;

        const veryRecentLog = recentLogs.find((l) => {
          const logTime = new Date(l.timestamp).getTime();
          if (logTime < intervalCutoff) return false;
          const logChamber = chambers.find((c) => c.servoId === l.chamberId);
          let logIngredients = l.activeIngredients || logChamber?.activeIngredients;
          if (!logIngredients || logIngredients.length === 0) {
            const m = findBestMatch(l.medicationName);
            if (m) logIngredients = m.activeIngredients;
          }
          return logIngredients?.some((i) => normalizeIngredientName(i.name) === key);
        });

        if (veryRecentLog) {
          const minutesAgo = Math.round(
            (Date.now() - new Date(veryRecentLog.timestamp).getTime()) / 60000
          );
          recentDoseIntervalViolation = {
            ingredientName: ing.name,
            lastTakenMinutesAgo: minutesAgo,
            minIntervalHours,
            medicationName: veryRecentLog.medicationName,
          };
          warnings.push(
            `Dosing interval warning: You took ${veryRecentLog.medicationName} (${ing.name}) only ${minutesAgo} minutes ago. Safe interval is at least ${minIntervalHours} hours.`
          );
        }
      }
    }

    return {
      safeToDispense: !hardBlocked && warnings.length === 0,
      hardBlocked,
      warnings,
      blockReason,
      exceededIngredient,
      recentDoseIntervalViolation,
    };
  },
};
