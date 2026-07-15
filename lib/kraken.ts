import { fetchWithRetry } from './http';
import { timeframeFor } from './timeframes';
import type { Candle } from './candleChart';

const KRAKEN_BASE =
  process.env.KRAKEN_BASE_URL ?? 'https://api.kraken.com/0/public';

export interface KrakenPrice {
  last: number;
  changePct: number;
}

// Kraken answers a failed query with HTTP 200 and a populated `error` array, so
// `response.ok` alone would let "Unknown asset pair" through as success.
interface KrakenEnvelope<T> {
  error: string[];
  result: T;
}

async function krakenGet<T>(path: string, revalidate: number): Promise<T> {
  const response = await fetchWithRetry(`${KRAKEN_BASE}${path}`, {
    next: { revalidate },
  } as RequestInit);
  if (!response.ok) {
    throw new Error(`Kraken ${path}: HTTP ${response.status}`);
  }
  const body = (await response.json()) as KrakenEnvelope<T>;
  if (body.error?.length) {
    throw new Error(`Kraken ${path}: ${body.error.join(', ')}`);
  }
  return body.result;
}

// `c` is [last trade price, lot volume]; `o` is today's opening price.
type TickerResult = Record<string, { c: [string, string]; o: string }>;

const percentChange = (last: number, open: number) =>
  open === 0 ? 0 : ((last - open) / open) * 100;

// One request for every pair. Kraken keys the response by its own canonical pair
// name and not in the order asked, so callers must look up by name.
export async function fetchKrakenPrices(
  pairs: readonly string[],
): Promise<Map<string, KrakenPrice>> {
  const result = await krakenGet<TickerResult>(
    `/Ticker?pair=${pairs.join(',')}`,
    30,
  );

  return new Map(
    Object.entries(result).map(([pair, ticker]) => {
      const last = Number(ticker.c[0]);
      const open = Number(ticker.o);
      return [pair, { last, changePct: percentChange(last, open) }];
    }),
  );
}

type OhlcRow = [number, string, string, string, string, string, string, number];

export async function fetchKrakenCandles(
  pair: string,
  days: number,
): Promise<Candle[]> {
  const timeframe = timeframeFor(days);
  if (!timeframe) throw new Error(`No timeframe is mapped for ${days} days`);
  const { interval, points } = timeframe;
  const result = await krakenGet<Record<string, OhlcRow[] | number>>(
    `/OHLC?pair=${pair}&interval=${interval}`,
    300,
  );

  const rows = Object.entries(result).find(([key]) => key !== 'last')?.[1];
  if (!Array.isArray(rows)) {
    throw new Error(`Kraken OHLC ${pair}: no candles in response`);
  }

  // Rows are [time, open, high, low, close, vwap, volume, count]: prices arrive
  // as strings, and the timestamp is in seconds.
  return rows.slice(-points).map(([time, open, high, low, close]) => ({
    t: time * 1000,
    o: Number(open),
    h: Number(high),
    l: Number(low),
    c: Number(close),
  }));
}
