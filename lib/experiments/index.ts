// Explicit, and deliberately without `server.ts` or `requestUnitId.ts`: those
// import `next/headers` and `next/server`, and a barrel re-export would pull
// request-scoped server APIs into any client component importing a type here.
export { hashToBucket, assignVariant } from './assign';
export type { Experiment, Variants, VariantOf } from './assign';
export { CHANGE_PILL_STYLE } from './registry';
export type { ChangePillVariant } from './registry';
export { createExposureLogger, consoleSink } from './exposure';
export type { ExposureEvent, ExposureSink } from './exposure';
