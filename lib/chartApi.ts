import type { Candle } from './candleChart';

// The route bounds its own upstream calls; nothing bounded this one. Unbounded,
// a stall leaves the chart dimmed and busy for good. Failing is recoverable.
const TIMEOUT_MS = 15_000;

export async function fetchCandles(
  coinId: string,
  days: number,
  signal?: AbortSignal,
): Promise<Candle[]> {
  // Both, not either: the caller's signal aborts a superseded request, the
  // timeout ends one nobody is going to answer.
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(`/api/chart/${coinId}?days=${days}`, {
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  });
  if (!res.ok) {
    throw new Error(
      `Chart request failed for ${coinId} (${days}d): ${res.status}`,
    );
  }
  const data = (await res.json()) as { candles?: Candle[] };
  return data.candles ?? [];
}
