import type { Candle } from './candleChart';

// The route handler bounds its own upstream calls, but nothing bounds this one:
// between here and there sit a serverless cold start and whatever the phone is
// connected to. Unbounded, a stalled request leaves the chart dimmed and busy
// forever — no error, no retry, no way out but a reload. Failing is
// recoverable; hanging is not.
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
