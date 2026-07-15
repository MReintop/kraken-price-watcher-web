import { NextRequest } from 'next/server';
import { getCoinCandles } from '@/lib/coins';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const days = req.nextUrl.searchParams.get('days') ?? '30';
  const candles = await getCoinCandles(id, days);
  return Response.json({ candles });
}
