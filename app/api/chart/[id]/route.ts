import { NextRequest } from 'next/server';
import { getCoinCandles, isTrackedCoin } from '@/lib/coins';
import { DEFAULT_DAYS, timeframeFor } from '@/lib/timeframes';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const daysParam = req.nextUrl.searchParams.get('days');
  const days = daysParam === null ? DEFAULT_DAYS : Number(daysParam);

  if (!isTrackedCoin(id)) {
    return Response.json({ error: `Unknown coin: ${id}` }, { status: 404 });
  }

  if (!timeframeFor(days)) {
    return Response.json(
      { error: `Unsupported timeframe: ${daysParam}` },
      { status: 400 },
    );
  }

  try {
    const candles = await getCoinCandles(id, days);
    return Response.json({ candles });
  } catch (error) {
    // 502, not 500: the request was well-formed and we are not broken — the
    // exchange is. The distinction is the whole answer to whether a caller
    // should retry, and a 500 would have thrown that away.
    console.error(`chart ${id} ${days}d:`, error);
    return Response.json({ error: 'Upstream unavailable' }, { status: 502 });
  }
}
