// The label the UI shows and the geometry Kraken needs, in one row: split apart,
// a button can exist with no interval and render another timeframe's data.
export const TIMEFRAMES = [
  { days: 1, label: '24H', interval: 60, points: 24 },
  { days: 30, label: '1M', interval: 1440, points: 30 },
  { days: 365, label: '1Y', interval: 10080, points: 52 },
] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const DEFAULT_DAYS = 30;

export const timeframeFor = (days: number): Timeframe | undefined =>
  TIMEFRAMES.find((timeframe) => timeframe.days === days);
