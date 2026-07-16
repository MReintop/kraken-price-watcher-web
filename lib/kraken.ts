import { fetchWithRetry } from './http';
import { timeframeFor } from './timeframes';
import type { Candle } from './candleChart';

const KRAKEN_BASE =
  process.env.KRAKEN_BASE_URL ?? 'https://api.kraken.com/0/public';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function krakenGet<T>(path: string, revalidate: number): Promise<T> {
  const response = await fetchWithRetry(`${KRAKEN_BASE}${path}`, {
    next: { revalidate },
  } as RequestInit);
  if (!response.ok) {
    throw new Error(`Kraken ${path}: HTTP ${response.status}`);
  }

  // Valid JSON is not this API. A proxy's error page, a login redirect and a
  // changed contract all parse, and only the shape tells them apart.
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.error) || !isRecord(body.result)) {
    throw new Error(`Kraken ${path}: unrecognised response envelope`);
  }
  // Kraken answers a failed query with HTTP 200 and a populated `error` array,
  // so `response.ok` alone would let "Unknown asset pair" through as success.
  if (body.error.length) {
    throw new Error(`Kraken ${path}: ${body.error.join(', ')}`);
  }
  return body.result as T;
}

// `c` is [last trade price, lot volume]. `o` is unused: it is *today's* open, so
// a change from it measures however long today has been, not 24 hours.
type TickerResult = Record<string, { c: [string, string] }>;

// The wire type is checked before the conversion, never after: Number('') is 0,
// and so are Number(null), Number(false) and Number([]). Every one of those
// passes a finite check and renders as a real price of nothing.
function toNumber(raw: unknown, context: string): number {
  const value =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(value)) {
    throw new Error(`Kraken ${context}: expected a number, got ${String(raw)}`);
  }
  return value;
}

// Zero is not a trade, and a negative one is not a price. Either would draw:
// the chart would scale its whole domain to accommodate it.
function toPrice(raw: unknown, context: string): number {
  const value = toNumber(raw, context);
  if (value <= 0) {
    throw new Error(
      `Kraken ${context}: expected a positive price, got ${value}`,
    );
  }
  return value;
}

// One request for every pair. Kraken keys the response by its own canonical pair
// name and not in the order asked, so callers must look up by name.
export async function fetchKrakenPrices(
  pairs: readonly string[],
): Promise<Map<string, number>> {
  const result = await krakenGet<TickerResult>(
    `/Ticker?pair=${pairs.join(',')}`,
    30,
  );

  return new Map(
    Object.entries(result).map(([pair, ticker]) => [
      pair,
      toPrice(ticker?.c?.[0], `${pair} last`),
    ]),
  );
}

// Seconds since the epoch, and the chart's x-axis. A zero is 1970, and one row
// carrying it stretches the domain across half a century of empty space.
function toTimestamp(raw: unknown, context: string): number {
  const seconds = toNumber(raw, context);
  if (seconds <= 0) {
    throw new Error(`Kraken ${context}: expected a timestamp, got ${seconds}`);
  }
  return seconds * 1000;
}

// Kraken's own invariant, and the geometry's: a body drawn outside its wick is
// not a candle. `l <= h` follows from both checks and is not tested for.
function assertConsistent(candle: Candle, context: string) {
  const { o, h, l, c } = candle;
  if (l > Math.min(o, c) || h < Math.max(o, c)) {
    throw new Error(
      `Kraken ${context}: candle is not self-consistent (o ${o} h ${h} l ${l} c ${c})`,
    );
  }
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
  // as strings, and the timestamp is in seconds. A NaN here reaches SVG geometry
  // and draws nothing, silently, so it stops here instead.
  return rows.slice(-points).map((row) => {
    if (!Array.isArray(row)) {
      throw new Error(
        `Kraken OHLC ${pair}: expected a row, got ${String(row)}`,
      );
    }
    const [time, open, high, low, close] = row;
    const candle: Candle = {
      t: toTimestamp(time, `${pair} time`),
      o: toPrice(open, `${pair} open`),
      h: toPrice(high, `${pair} high`),
      l: toPrice(low, `${pair} low`),
      c: toPrice(close, `${pair} close`),
    };
    assertConsistent(candle, `OHLC ${pair}`);
    return candle;
  });
}
