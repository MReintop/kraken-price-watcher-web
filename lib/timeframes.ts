// One row per timeframe: the label the UI shows, and the geometry Kraken needs
// (it buckets by minutes-per-candle, so an interval plus how many to keep).
// Held together because split apart, a button can exist with no interval behind
// it and silently render another timeframe's data under its label.
export const TIMEFRAMES = [
  { days: 1, label: '24H', interval: 60, points: 24 },
  { days: 30, label: '1M', interval: 1440, points: 30 },
  { days: 365, label: '1Y', interval: 10080, points: 52 },
] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const DEFAULT_DAYS = 30;

export const timeframeFor = (days: number): Timeframe | undefined =>
  TIMEFRAMES.find((timeframe) => timeframe.days === days);
