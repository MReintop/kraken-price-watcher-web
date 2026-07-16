'use client';

import { useAppSelector } from '@/store/hooks';
import { selectIsUnavailable, selectPrice } from '@/store/pricesSlice';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import styles from './CoinPriceRow.module.css';

interface CoinPriceRowProps {
  symbol: string;
  priceDecimals: number;
  // Server data, passed rather than stored: CoinGecko's 24h change is a
  // cross-exchange figure, and the socket's is Kraken's own. Keeping it out of
  // the store is what stops a tick quietly swapping one for the other.
  changePct: number | null;
}

export default function CoinPriceRow({
  symbol,
  priceDecimals,
  changePct,
}: CoinPriceRowProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const unavailable = useAppSelector(selectIsUnavailable(symbol.toUpperCase()));
  if (price == null) return <></>;

  const up = changePct != null && changePct >= 0;
  const pillClass = changePct == null ? styles.pillFlat : undefined;

  return (
    <div className={styles.body}>
      <AnimatedPrice
        value={price}
        decimals={priceDecimals}
        className={`${styles.price} ${unavailable ? styles.priceStale : ''}`}
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

        {/* Said here, not only on the coin's own page: this is the screen people
            actually watch, and a price Kraken refused to send looks exactly like
            a live one until something says otherwise. Plain text rather than a
            live region — eight rows announcing at once would help no one. */}
        {unavailable && <span className={styles.stale}>Not updating</span>}
      </div>
    </div>
  );
}
