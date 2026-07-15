import { formatPrice } from './format';

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export function applyLivePrice(candles: Candle[], price?: number): Candle[] {
  if (price == null || candles.length === 0) return candles;
  const last = candles[candles.length - 1];
  const updated: Candle = {
    ...last,
    c: price,
    h: Math.max(last.h, price),
    l: Math.min(last.l, price),
  };
  return [...candles.slice(0, -1), updated];
}

export function periodChangePct(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  const first = candles[0].o;
  if (first === 0) return null;
  return ((candles[candles.length - 1].c - first) / first) * 100;
}

// The shape gives a sighted reader range and trend; "candlestick chart" gives a
// screen reader nothing. In words, not arrows — "▼" announces as nothing.
export function describeCandles(candles: Candle[], days: number): string {
  if (candles.length === 0) return `${days}-day candlestick chart, no data`;

  const { min, max } = priceDomain(candles);
  const change = periodChangePct(candles);
  const trend =
    change == null
      ? ''
      : ` ${change >= 0 ? 'Up' : 'Down'} ${Math.abs(change).toFixed(2)}% over the period.`;

  return `${days}-day candlestick chart, ${candles.length} candles. Low ${formatPrice(min)}, high ${formatPrice(max)}.${trend}`;
}

export interface PriceDomain {
  min: number;
  max: number;
}

export function priceDomain(candles: Candle[]): PriceDomain {
  if (candles.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  if (min !== max) return { min, max };

  // A flat market has no range to scale against, and the substitute lands every
  // candle on the floor — a market that did not move, drawn as one that crashed.
  const pad = Math.abs(min) * 0.001 || 1;
  return { min: min - pad, max: max + pad };
}

export function priceToY(
  price: number,
  domain: PriceDomain,
  height: number,
): number {
  const range = domain.max - domain.min || 1;
  return height - ((price - domain.min) / range) * height;
}

function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nice: number;
  if (round) nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * Math.pow(10, exp);
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max <= min) return [min];
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(count - 1, 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

export function evenlySpacedIndices(n: number, count: number): number[] {
  if (n <= 0 || count <= 0) return [];
  const k = Math.min(count, n);
  if (k === 1) return [0];
  return Array.from({ length: k }, (_, i) =>
    Math.round((i * (n - 1)) / (k - 1)),
  );
}

export function formatAxisPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toPrecision(3);
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const pad = (n: number) => String(n).padStart(2, '0');

// X-axis label per timeframe: 24H→HH:mm, 1M→DD.MM, 1Y→Mon DD. UTC = deterministic.
export function formatAxisTime(ts: number, days: number): string {
  const d = new Date(ts);
  if (days <= 1) return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  if (days <= 30) return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export interface CandleLayout {
  x: number;
  bodyY: number;
  bodyWidth: number;
  bodyHeight: number;
  wickX: number;
  wickTop: number;
  wickBottom: number;
  up: boolean;
}

export function computeCandleLayout(
  candles: Candle[],
  size: { width: number; height: number },
  domain: PriceDomain = priceDomain(candles),
): CandleLayout[] {
  if (candles.length === 0) return [];

  const { width, height } = size;
  const slot = width / candles.length;
  const bodyWidth = Math.max(slot * 0.6, 1);

  return candles.map((c, i) => {
    const center = (i + 0.5) * slot;
    const top = priceToY(Math.max(c.o, c.c), domain, height);
    const bottom = priceToY(Math.min(c.o, c.c), domain, height);
    return {
      x: center - bodyWidth / 2,
      bodyY: top,
      bodyWidth,
      bodyHeight: Math.max(bottom - top, 1),
      wickX: center,
      wickTop: priceToY(c.h, domain, height),
      wickBottom: priceToY(c.l, domain, height),
      up: c.c >= c.o,
    };
  });
}
