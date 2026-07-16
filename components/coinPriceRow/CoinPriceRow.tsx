'use client';

import { useAppSelector } from '@/store/hooks';
import { selectEffectiveStatus, selectPrice } from '@/store/pricesSlice';
import { isPriceCurrent, STATUS_LABEL } from '@/lib/feedStatus';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import styles from './CoinPriceRow.module.css';

interface CoinPriceRowProps {
  symbol: string;
  // Server data, passed rather than stored: CoinGecko's 24h change is a
  // cross-exchange figure, and the socket's is Kraken's own. Keeping it out of
  // the store is what stops a tick quietly swapping one for the other.
  changePct: number | null;
}

export default function CoinPriceRow({ symbol, changePct }: CoinPriceRowProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const status = useAppSelector(selectEffectiveStatus(symbol.toUpperCase()));
  if (price == null) return <></>;

  const up = changePct != null && changePct >= 0;
  const pillClass = changePct == null ? styles.pillFlat : undefined;

  return (
    <div className={styles.body}>
      {/* Muted the moment the number stops being the live one, whether the feed
          died or this symbol was never on it. A dead feed's last price looks
          exactly like a current one otherwise. */}
      <AnimatedPrice
        value={price}
        className={`${styles.price} ${isPriceCurrent(status) ? '' : styles.priceStale}`}
      />
      <div className={styles.meta}>
        <span
          className={`${styles.pill} ${pillClass ?? (up ? styles.pillUp : styles.pillDown)}`}
          title="24h change across exchanges, from CoinGecko"
        >
          {/* An upstream that cannot measure the change says so; inventing 0.00%
              would read as a market that did not move. */}
          {changePct == null ? '—' : `${up ? '+' : ''}${changePct.toFixed(2)}%`}
        </span>

        {/* Only what is true of this symbol alone; the feed's own state is said
            once, above the list. Plain text rather than a live region — eight
            rows announcing at once would help no one. */}
        {status === 'unavailable' && (
          <span className={styles.stale}>{STATUS_LABEL.unavailable}</span>
        )}
      </div>
    </div>
  );
}
