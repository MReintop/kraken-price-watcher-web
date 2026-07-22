import { computeReadout, normalCdf } from './readout';
import type { ExperimentEvent } from './events';

// Fixtures over the wire shapes, never over internals — and every expected
// number below is computable by hand, because a z-test that returns a
// plausible number for garbage input is the same failure shape as `--2.34%`.

const EXP = {
  key: 'change_pill_style_v1',
  variants: ['control', 'arrow'],
} as const;

const exposure = (variant: string, unitId: string): ExperimentEvent => ({
  kind: 'exposure',
  experiment: EXP.key,
  variant,
  unitId,
  at: 1,
});

const outcome = (unitId: string): ExperimentEvent => ({
  kind: 'outcome',
  name: 'coin_tap',
  unitId,
  at: 2,
});

// n exposures to a variant, the first `converting` of them also tapping.
function arm(
  variant: string,
  n: number,
  converting: number,
): ExperimentEvent[] {
  const events: ExperimentEvent[] = [];
  for (let i = 0; i < n; i++) {
    const unitId = `${variant}-${i}`;
    events.push(exposure(variant, unitId));
    if (i < converting) events.push(outcome(unitId));
  }
  return events;
}

describe('computeReadout — the worked example', () => {
  // control 1000/100 (10%), arrow 1000/124 (12.4%):
  //   pooled p = 224/2000 = 0.112, SE = √(0.112·0.888·2/1000) = 0.014104
  //   z = 0.024/0.014104 = 1.702, p = 2(1−Φ(1.702)) ≈ 0.0888
  //   unpooled SE = √(0.09/1000 + 0.108624/1000) = 0.014093
  //   CI = 0.024 ± 1.96·0.014093 = (−0.00362, +0.05162)
  const readout = computeReadout(
    [...arm('control', 1000, 100), ...arm('arrow', 1000, 124)],
    EXP,
    'coin_tap',
  );

  it('counts the arms', () => {
    expect(readout.arms).toEqual([
      { variant: 'control', exposures: 1000, conversions: 100, rate: 0.1 },
      { variant: 'arrow', exposures: 1000, conversions: 124, rate: 0.124 },
    ]);
  });

  it('computes z, p and the CI to the hand-checked values', () => {
    expect(readout.srm.triggered).toBe(false);
    expect(readout.lift).toBeDefined();
    expect(readout.lift!.absolute).toBeCloseTo(0.024, 10);
    expect(readout.lift!.z).toBeCloseTo(1.702, 3);
    expect(readout.lift!.pValue).toBeCloseTo(0.0888, 3);
    expect(readout.lift!.ci95[0]).toBeCloseTo(-0.00362, 4);
    expect(readout.lift!.ci95[1]).toBeCloseTo(0.05162, 4);
    expect(readout.lift!.approximationWeak).toBe(false);
  });

  it('is clean on every integrity counter', () => {
    expect(readout.anonymousEvents).toBe(0);
    expect(readout.orphanOutcomes).toBe(0);
    expect(readout.mixedAssignments).toBe(0);
  });
});

describe('computeReadout — fixtures with hand-computable answers', () => {
  it('equal rates → z = 0, p = 1, lift 0, CI symmetric around 0', () => {
    const readout = computeReadout(
      [...arm('control', 1000, 500), ...arm('arrow', 1000, 500)],
      EXP,
      'coin_tap',
    );
    expect(readout.lift!.absolute).toBe(0);
    expect(readout.lift!.z).toBe(0);
    expect(readout.lift!.pValue).toBeCloseTo(1, 6);
    expect(readout.lift!.ci95[0]).toBeCloseTo(-readout.lift!.ci95[1], 10);
  });

  it('1000 vs 500 exposures → SRM fires (χ² = 166.7) and the lift is WITHHELD', () => {
    const readout = computeReadout(
      [...arm('control', 1000, 100), ...arm('arrow', 500, 60)],
      EXP,
      'coin_tap',
    );
    expect(readout.srm.chi2).toBeCloseTo(166.67, 1);
    expect(readout.srm.triggered).toBe(true);
    expect(readout.lift).toBeUndefined();
    expect(readout.withheld).toMatch(/SRM/);
  });

  it('1000 vs 900 is suspicious but NOT an SRM verdict at the 0.001 threshold', () => {
    // χ² = 2·50²/950 = 5.26 → p ≈ 0.022: fails 0.05, passes 0.001 — the
    // threshold exists because SRM is checked on every readout.
    const readout = computeReadout(
      [...arm('control', 1000, 100), ...arm('arrow', 900, 90)],
      EXP,
      'coin_tap',
    );
    expect(readout.srm.chi2).toBeCloseTo(5.26, 2);
    expect(readout.srm.pValue).toBeCloseTo(0.022, 3);
    expect(readout.srm.triggered).toBe(false);
    expect(readout.lift).toBeDefined();
  });

  it('zero conversions everywhere → withheld, and no NaN anywhere', () => {
    const readout = computeReadout(
      [...arm('control', 100, 0), ...arm('arrow', 100, 0)],
      EXP,
      'coin_tap',
    );
    expect(readout.lift).toBeUndefined();
    expect(readout.withheld).toMatch(/no variation/);
    expect(Number.isNaN(readout.srm.chi2)).toBe(false);
  });

  it('zero conversions in ONE arm still computes, flagged as weak', () => {
    // pooled = 10/200 = 0.05, SE = √(0.05·0.95·0.02) = 0.03082
    // z = 0.1/0.03082 = 3.244 — finite, no divide-by-zero
    const readout = computeReadout(
      [...arm('control', 100, 0), ...arm('arrow', 100, 10)],
      EXP,
      'coin_tap',
    );
    expect(readout.lift).toBeDefined();
    expect(readout.lift!.z).toBeCloseTo(3.244, 3);
    expect(readout.lift!.approximationWeak).toBe(true);
    expect(Number.isFinite(readout.lift!.ci95[0])).toBe(true);
  });

  it('no exposures at all → withheld, not a crash', () => {
    const readout = computeReadout([outcome('u-1')], EXP, 'coin_tap');
    expect(readout.withheld).toBeDefined();
    expect(readout.lift).toBeUndefined();
  });
});

describe('computeReadout — the join and its integrity counters', () => {
  it('duplicate exposures count a unit once (the at-least-once sink)', () => {
    const readout = computeReadout(
      [
        exposure('control', 'u-1'),
        exposure('control', 'u-1'), // a restart replayed it
        exposure('control', 'u-1'),
        exposure('arrow', 'u-2'),
      ],
      EXP,
      'coin_tap',
    );
    expect(readout.arms[0].exposures).toBe(1);
  });

  it('a unit that tapped seven coins converts once', () => {
    const events = [exposure('control', 'u-1'), exposure('arrow', 'u-2')];
    for (let i = 0; i < 7; i++) events.push(outcome('u-1'));
    const readout = computeReadout(events, EXP, 'coin_tap');
    expect(readout.arms[0].conversions).toBe(1);
  });

  it('a unit seen under both variants is contamination: excluded and counted', () => {
    const readout = computeReadout(
      [
        exposure('control', 'u-1'),
        exposure('arrow', 'u-1'), // the same browser, both treatments
        exposure('arrow', 'u-2'),
        outcome('u-1'),
      ],
      EXP,
      'coin_tap',
    );
    expect(readout.mixedAssignments).toBe(1);
    expect(readout.arms[0].exposures).toBe(0);
    expect(readout.arms[1].exposures).toBe(1);
  });

  it('an outcome no exposure claims is an orphan, not a conversion', () => {
    const readout = computeReadout(
      [exposure('control', 'u-1'), outcome('u-unknown')],
      EXP,
      'coin_tap',
    );
    expect(readout.orphanOutcomes).toBe(1);
    expect(readout.arms[0].conversions).toBe(0);
  });

  it('anonymous events are counted and kept out of every arm', () => {
    const readout = computeReadout(
      [
        exposure('control', 'anonymous'), // the bridge broke
        outcome('anonymous'), // the cookie was missing at ingest
        exposure('control', 'u-1'),
      ],
      EXP,
      'coin_tap',
    );
    expect(readout.anonymousEvents).toBe(2);
    expect(readout.arms[0].exposures).toBe(1);
    expect(readout.orphanOutcomes).toBe(0);
  });

  it('ignores exposures of other experiments and outcomes of other names', () => {
    const readout = computeReadout(
      [
        {
          kind: 'exposure',
          experiment: 'other_test_v1',
          variant: 'control',
          unitId: 'u-1',
          at: 1,
        },
        { kind: 'outcome', name: 'other_metric', unitId: 'u-1', at: 2 },
      ],
      EXP,
      'coin_tap',
    );
    expect(readout.arms[0].exposures).toBe(0);
    expect(readout.orphanOutcomes).toBe(0);
  });
});

describe('normalCdf', () => {
  it('matches the table values the hand calculations used', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(1.7)).toBeCloseTo(0.9554, 4);
    expect(normalCdf(-1.7)).toBeCloseTo(0.0446, 4);
  });
});
