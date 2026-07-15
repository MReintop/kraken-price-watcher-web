'use client';

import { useRef, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectPrice } from '@/store/pricesSlice';
import {
  applyLivePrice,
  periodChangePct,
  type Candle,
} from '@/lib/candleChart';
import { formatSignedPct } from '@/lib/format';
import { fetchCandles } from '@/lib/chartApi';
import TimeframeSelector from './TimeframeSelector';
import CandlestickChart from './CandlestickChart';
import styles from './CoinChart.module.css';

interface CoinChartProps {
  coinId: string;
  symbol: string;
  initialCandles: Candle[];
  initialDays?: number;
}

export default function CoinChart({
  coinId,
  symbol,
  initialCandles,
  initialDays = 30,
}: CoinChartProps) {
  const [days, setDays] = useState(initialDays);
  const [candles, setCandles] = useState(initialCandles);
  const [loading, setLoading] = useState(false);
  const live = useAppSelector(selectPrice(symbol.toUpperCase()));
  const inFlight = useRef<AbortController | null>(null);

  // Aborts the previous request so a slow response cannot overwrite a newer one.
  const changeTimeframe = async (nextDays: number) => {
    if (nextDays === days) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setDays(nextDays);
    setLoading(true);
    try {
      setCandles(await fetchCandles(coinId, nextDays, controller.signal));
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setCandles([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const folded = applyLivePrice(candles, live?.last);
  const change = periodChangePct(folded);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {change != null && (
          <span className={change >= 0 ? styles.up : styles.down}>
            {formatSignedPct(change)}
          </span>
        )}
        <TimeframeSelector value={days} onChange={changeTimeframe} />
      </div>

      {folded.length < 2 ? (
        <p className={styles.empty}>Chart unavailable</p>
      ) : (
        <div className={loading ? styles.dim : undefined}>
          <CandlestickChart
            candles={folded}
            width={600}
            height={240}
            days={days}
          />
        </div>
      )}
    </div>
  );
}
