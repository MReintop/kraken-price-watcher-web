import { type EventSink, consoleSink } from './events';

export type { ExposureEvent, EventSink } from './events';

// Dedupe is per process and never evicted: a second instance logs the same user
// again, and the set grows with the audience. That is why the sink is only an
// optimization to keep the log small — the READOUT re-dedupes on
// (experiment, unitId) and is the count that gets trusted.
export function createExposureLogger(sink: EventSink = consoleSink) {
  const seen = new Set<string>();
  return function logExposure(
    experiment: string,
    variant: string,
    unitId: string,
  ): void {
    const dedupeKey = `${experiment}:${unitId}`;
    if (seen.has(dedupeKey)) return; // this user already counted for this test
    seen.add(dedupeKey);
    sink({ kind: 'exposure', experiment, variant, unitId, at: Date.now() });
  };
}
