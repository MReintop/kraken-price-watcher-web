export interface ExposureEvent {
  experiment: string;
  variant: string;
  unitId: string;
  at: number;
}

export type ExposureSink = (event: ExposureEvent) => void;

// The only destination that exists today. A real one replaces it here.
export const consoleSink: ExposureSink = (event) => {
  console.log('[exposure]', JSON.stringify(event));
};

// Dedupe is per process and never evicted: a second instance logs the same user
// again, and the set grows with the audience. The sink is the place to fix that.
export function createExposureLogger(sink: ExposureSink = consoleSink) {
  const seen = new Set<string>();
  return function logExposure(
    experiment: string,
    variant: string,
    unitId: string,
  ): void {
    const dedupeKey = `${experiment}:${unitId}`;
    if (seen.has(dedupeKey)) return; // this user already counted for this test
    seen.add(dedupeKey);
    sink({ experiment, variant, unitId, at: Date.now() });
  };
}
