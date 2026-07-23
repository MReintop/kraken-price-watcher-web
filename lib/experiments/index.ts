// Explicit, and deliberately without `server.ts` or `requestUnitId.ts`: those
// import `next/headers` and `next/server`, and a barrel re-export would pull
// request-scoped server APIs into any client component importing a type here.
export { hashToBucket, assignVariant } from './assign';
export type { Experiment, Variants, VariantOf } from './assign';
export { CHANGE_PILL_STYLE, OUTCOME_NAMES } from './registry';
export type { ChangePillVariant, OutcomeName } from './registry';
export { createExposureLogger } from './exposure';
export { consoleSink } from './events';
export type {
  ExposureEvent,
  OutcomeEvent,
  ExperimentEvent,
  EventSink,
} from './events';
