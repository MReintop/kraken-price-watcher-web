import type { Experiment, VariantOf } from './assign';

// Does a directional arrow on the 24h-change pill lift tap-through?
// variants[0] = 'control' is exactly what ships today, so a user in control sees
// no change at all — the safe default is the current behaviour.
//
// The key is the hash salt, so it is versioned: changing the variants, their
// order or the hash reassigns everyone already in the test. Start a _v2 instead
// of editing this in place.
export const CHANGE_PILL_STYLE = {
  key: 'change_pill_style_v1',
  variants: ['control', 'arrow'],
} as const satisfies Experiment;

export type ChangePillVariant = VariantOf<typeof CHANGE_PILL_STYLE>;
