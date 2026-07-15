import { NextRequest } from 'next/server';
import { getCoinCandles } from '@/lib/coins';
import { DEFAULT_DAYS, timeframeFor } from '@/lib/timeframes';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const daysParam = req.nextUrl.searchParams.get('days');
  const days = daysParam === null ? DEFAULT_DAYS : Number(daysParam);

  if (!timeframeFor(days)) {
    return Response.json(
      { error: `Unsupported timeframe: ${daysParam}` },
      { status: 400 },
    );
  }

  const candles = await getCoinCandles(id, days);
  return Response.json({ candles });
}
