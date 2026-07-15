'use client';

import { useAppSelector } from '@/store/hooks';
import { selectPrice } from '@/store/pricesSlice';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import styles from './CoinPriceRow.module.css';

interface CoinPriceRowProps {
  symbol: string;
  // Server data, passed rather than stored: CoinGecko's 24h change is a
  // cross-exchange figure, and the socket's is Kraken's own. Keeping it out of
  // the store is what stops a tick quietly swapping one for the other.
  changePct: number;
}

export default function CoinPriceRow({ symbol, changePct }: CoinPriceRowProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  if (price == null) return <></>;

  const up = changePct >= 0;

  return (
    <div className={styles.body}>
      <AnimatedPrice value={price} className={styles.price} />
      <span
        className={`${styles.pill} ${up ? styles.pillUp : styles.pillDown}`}
        title="24h change across exchanges, from CoinGecko"
      >
        {up ? '+' : ''}
        {changePct.toFixed(2)}%
      </span>
    </div>
  );
}
