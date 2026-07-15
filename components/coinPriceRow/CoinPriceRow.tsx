'use client';

import { useAppSelector } from '@/store/hooks';
import { selectPrice } from '@/store/pricesSlice';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import styles from './CoinPriceRow.module.css';

export default function CoinPriceRow({ symbol }: { symbol: string }) {
  const data = useAppSelector(selectPrice(symbol.toUpperCase()));
  if (!data) return <></>;

  const up = data.changePct >= 0;

  return (
    <div className={styles.body}>
      <AnimatedPrice value={data.last} className={styles.price} />
      <span
        className={`${styles.pill} ${up ? styles.pillUp : styles.pillDown}`}
      >
        {up ? '+' : ''}
        {data.changePct.toFixed(2)}%
      </span>
    </div>
  );
}
