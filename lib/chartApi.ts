import type { Candle } from './candleChart';

export async function fetchCandles(
  coinId: string,
  days: number,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const res = await fetch(`/api/chart/${coinId}?days=${days}`, { signal });
  if (!res.ok) {
    throw new Error(
      `Chart request failed for ${coinId} (${days}d): ${res.status}`,
    );
  }
  const data = (await res.json()) as { candles?: Candle[] };
  return data.candles ?? [];
}
