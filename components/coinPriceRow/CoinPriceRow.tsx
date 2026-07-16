'use client';

import { useAppSelector } from '@/store/hooks';
import { selectEffectiveStatus, selectPrice } from '@/store/pricesSlice';
import { isPriceCurrent, STATUS_LABEL } from '@/lib/feedStatus';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import styles from './CoinPriceRow.module.css';

interface CoinPriceRowProps {
  symbol: string;
  priceDecimals: number;
  changePct24H: number | null;
}

export default function CoinPriceRow({
  symbol,
  priceDecimals,
  changePct24H,
}: CoinPriceRowProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const status = useAppSelector(selectEffectiveStatus(symbol.toUpperCase()));
  if (price == null) return <></>;

  const up = changePct24H != null && changePct24H >= 0;
  const pillClass = changePct24H == null ? styles.pillFlat : undefined;

  return (
    <div className={styles.body}>
      {/* Muted the moment the number stops being the live one, whether the feed
          died or this symbol was never on it. */}
      <AnimatedPrice
        value={price}
        decimals={priceDecimals}
        className={`${styles.price} ${isPriceCurrent(status) ? '' : styles.priceStale}`}
      />
      <div className={styles.meta}>
        <span
          className={`${styles.pill} ${pillClass ?? (up ? styles.pillUp : styles.pillDown)}`}
          title="24h change across exchanges, from CoinGecko"
        >
          {changePct24H == null
            ? '—'
            : `${up ? '+' : ''}${changePct24H.toFixed(2)}%`}
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
