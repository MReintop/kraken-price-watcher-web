import type { Experiment } from './assign';
import type { ExperimentEvent } from './events';
import { ANONYMOUS_UNIT } from './unit.ts';

// The analysis half of the contract: replay the event log, join the two event
// kinds on unitId, and refuse to print a lift the data cannot support. Pure —
// arrays in, verdict out — so every branch is testable with fixtures whose
// answers are computable by hand.

export interface ArmReadout {
  variant: string;
  exposures: number;
  conversions: number;
  rate: number;
}

export interface Readout {
  experiment: string;
  outcome: string;
  arms: ArmReadout[];
  // Integrity counters — each one nonzero is a question to answer BEFORE the
  // lift means anything.
  anonymousEvents: number; // events that arrived without an established unit
  orphanOutcomes: number; // converting units no exposure ever claimed
  mixedAssignments: number; // units seen under 2+ variants — contamination
  srm: { chi2: number; pValue: number; triggered: boolean };
  // Present only when the data supports it; `withheld` says why otherwise.
  lift?: {
    absolute: number; // treatment rate − control rate
    z: number;
    pValue: number; // two-sided
    ci95: [number, number]; // unpooled, ±1.96·SE
    approximationWeak: boolean; // a cell under 5 — read with suspicion
  };
  withheld?: string;
}

// SRM is called at 0.001, not 0.05: it is checked on every readout, so a 5%
// false-alarm rate would cry wolf weekly. When it fires the lift is withheld
// entirely — assignment happens before the user sees anything, so a skewed
// split is always broken plumbing, and whatever ate the missing exposures
// did not eat converters and non-converters evenly.
export const SRM_THRESHOLD = 0.001;

// Abramowitz & Stegun 7.1.26 — |error| ≤ 1.5e-7, plenty against fixtures
// computed by hand to four decimals.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-z * z));
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// χ² with 1 degree of freedom IS the square of a standard normal, so the
// p-value needs no gamma function. Two arms only — a third variant needs a
// real chi-square distribution, and this throw is the reminder.
function chiSquarePValueDf1(chi2: number): number {
  return 2 * (1 - normalCdf(Math.sqrt(chi2)));
}

export function computeReadout(
  events: ExperimentEvent[],
  experiment: Experiment,
  outcome: string,
): Readout {
  if (experiment.variants.length !== 2) {
    throw new Error(
      'computeReadout: two-arm experiments only (lift and SRM df=1 assume it)',
    );
  }

  let anonymousEvents = 0;

  // First exposure wins per unit; a unit later seen under a DIFFERENT variant
  // is contaminated — it has been exposed to both treatments and belongs
  // cleanly to neither arm, so it is excluded rather than double-counted.
  const assigned = new Map<string, string>();
  const mixed = new Set<string>();
  for (const event of events) {
    if (event.kind !== 'exposure' || event.experiment !== experiment.key)
      continue;
    if (event.unitId === ANONYMOUS_UNIT) {
      anonymousEvents++;
      continue;
    }
    const prior = assigned.get(event.unitId);
    if (prior === undefined) assigned.set(event.unitId, event.variant);
    else if (prior !== event.variant) mixed.add(event.unitId);
  }
  for (const unitId of mixed) assigned.delete(unitId);

  // ≥1 outcome converts a unit once — a unit that tapped seven coins is one
  // converted unit, not seven, or the binomial variance the z-test assumes
  // stops describing the data.
  const converted = new Set<string>();
  for (const event of events) {
    if (event.kind !== 'outcome' || event.name !== outcome) continue;
    if (event.unitId === ANONYMOUS_UNIT) {
      anonymousEvents++;
      continue;
    }
    converted.add(event.unitId);
  }

  const arms: ArmReadout[] = experiment.variants.map((variant) => {
    let exposures = 0;
    let conversions = 0;
    for (const [unitId, assignedVariant] of assigned) {
      if (assignedVariant !== variant) continue;
      exposures++;
      if (converted.has(unitId)) conversions++;
    }
    return {
      variant,
      exposures,
      conversions,
      rate: exposures === 0 ? 0 : conversions / exposures,
    };
  });

  let orphanOutcomes = 0;
  for (const unitId of converted) {
    if (!assigned.has(unitId)) orphanOutcomes++;
  }

  // SRM before anything else: equal split by design, so expected = total/2.
  const total = arms[0].exposures + arms[1].exposures;
  const expected = total / 2;
  const chi2 =
    total === 0
      ? 0
      : arms.reduce(
          (sum, arm) => sum + (arm.exposures - expected) ** 2 / expected,
          0,
        );
  const srmPValue = total === 0 ? 1 : chiSquarePValueDf1(chi2);
  const srm = { chi2, pValue: srmPValue, triggered: srmPValue < SRM_THRESHOLD };

  const base: Readout = {
    experiment: experiment.key,
    outcome,
    arms,
    anonymousEvents,
    orphanOutcomes,
    mixedAssignments: mixed.size,
    srm,
  };

  // Withheld means withheld — no lift field at all. A readout that prints
  // "SRM ⚠️ but lift +24%!" will be read as "+24%".
  if (srm.triggered) {
    return {
      ...base,
      withheld: 'SRM: exposure counts are not the designed split',
    };
  }

  const [control, treatment] = arms;
  if (control.exposures === 0 || treatment.exposures === 0) {
    return { ...base, withheld: 'an arm has no exposures' };
  }

  const pooled =
    (control.conversions + treatment.conversions) /
    (control.exposures + treatment.exposures);
  const pooledSe = Math.sqrt(
    pooled * (1 - pooled) * (1 / control.exposures + 1 / treatment.exposures),
  );
  // Nobody converted, or everybody did: the pooled variance is zero and no
  // difference is distinguishable from none. Say so instead of dividing.
  if (pooledSe === 0) {
    return { ...base, withheld: 'no variation in outcomes to test against' };
  }

  const absolute = treatment.rate - control.rate;
  const z = absolute / pooledSe;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));

  // Unpooled for the interval: the CI describes the difference as it is, not
  // under the equal-rates hypothesis the test just entertained.
  const unpooledSe = Math.sqrt(
    (control.rate * (1 - control.rate)) / control.exposures +
      (treatment.rate * (1 - treatment.rate)) / treatment.exposures,
  );
  const ci95: [number, number] = [
    absolute - 1.96 * unpooledSe,
    absolute + 1.96 * unpooledSe,
  ];

  // The normal approximation wants ~5 in every cell (converted and not, per
  // arm) — below that the p-value is decoration, so it gets flagged.
  const approximationWeak = arms.some(
    (arm) => arm.conversions < 5 || arm.exposures - arm.conversions < 5,
  );

  return { ...base, lift: { absolute, z, pValue, ci95, approximationWeak } };
}
