// A non-empty tuple, so `variants[0]` is a variant rather than `undefined`. The
// first entry is the control by convention: it is what ships today.
export type Variants = readonly [control: string, ...treatments: string[]];

export interface Experiment<
  K extends string = string,
  V extends Variants = Variants,
> {
  readonly key: K;
  readonly variants: V;
}

// Carries a registry entry's literal variants through to its callers, so a
// typo'd 'arow' is a compile error rather than a silent control.
export type VariantOf<E extends Experiment> = E['variants'][number];

export function hashToBucket(unitId: string, salt: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  const input = `${unitId}:${salt}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return (h >>> 0) % 10000; // >>> 0 makes it unsigned
}

// Even splits only: the bucket's resolution is spent on `% variants.length`, so
// a weighted rollout (5% treatment) is not expressible without changing this.
export function assignVariant<E extends Experiment>(
  unitId: string,
  exp: E,
): VariantOf<E> {
  const bucket = hashToBucket(unitId, exp.key);
  return exp.variants[bucket % exp.variants.length];
}
