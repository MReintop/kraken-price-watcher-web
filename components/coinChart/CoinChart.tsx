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
  priceDecimals: number;
  initialDays?: number;
}

export default function CoinChart({
  coinId,
  symbol,
  initialCandles,
  priceDecimals,
  initialDays = 30,
}: CoinChartProps) {
  // `days` is what the chart on screen actually shows; `pendingDays` is what was
  // asked for and has not arrived. Keeping them apart is what stops 30-day
  // candles being drawn under a 1Y axis for the length of a fetch.
  const [days, setDays] = useState(initialDays);
  const [pendingDays, setPendingDays] = useState<number | null>(null);
  const [candles, setCandles] = useState(initialCandles);
  const [failedDays, setFailedDays] = useState<number | null>(null);
  const live = useAppSelector(selectPrice(symbol.toUpperCase()));
  const inFlight = useRef<AbortController | null>(null);

  // Aborts the previous request so a slow response cannot overwrite a newer one.
  const changeTimeframe = async (nextDays: number) => {
    if (nextDays === days && failedDays == null) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setPendingDays(nextDays);
    setFailedDays(null);
    try {
      const next = await fetchCandles(coinId, nextDays, controller.signal);
      // Committed together: the data and the label that describes it.
      setCandles(next);
      setDays(nextDays);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      // The old candles are still true, and still the last thing known. Throwing
      // them away to say "unavailable" loses a good chart to a failed request.
      setFailedDays(nextDays);
    } finally {
      if (!controller.signal.aborted) setPendingDays(null);
    }
  };

  const loading = pendingDays != null;

  const folded = applyLivePrice(candles, live);
  const change = periodChangePct(folded);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        {change != null && (
          <span className={change >= 0 ? styles.up : styles.down}>
            {formatSignedPct(change)}
          </span>
        )}
        {/* Follows the click, not the data: the request is the answer to the
            press, and aria-busy below says the chart is still catching up. */}
        <TimeframeSelector
          value={pendingDays ?? days}
          onChange={changeTimeframe}
        />
      </div>

      {failedDays != null && (
        <p className={styles.error} role="status">
          Couldn&apos;t load that timeframe.{' '}
          <button
            type="button"
            className={styles.retry}
            onClick={() => changeTimeframe(failedDays)}
          >
            Try again
          </button>
        </p>
      )}

      {folded.length < 2 ? (
        <p className={styles.empty}>Chart unavailable</p>
      ) : (
        <div className={loading ? styles.dim : undefined} aria-busy={loading}>
          <CandlestickChart
            candles={folded}
            width={600}
            height={240}
            days={days}
            priceDecimals={priceDecimals}
          />
        </div>
      )}
    </div>
  );
}
