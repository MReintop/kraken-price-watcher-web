'use client';

import { useAppSelector } from '@/store/hooks';
import { selectLive, selectPrice } from '@/store/pricesSlice';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import PriceTickIndicator from '@/components/priceTickIndicator/PriceTickIndicator';
import styles from './CoinPriceHeader.module.css';

interface CoinPriceHeaderProps {
  symbol: string;
}

export default function CoinPriceHeader({ symbol }: CoinPriceHeaderProps) {
  const data = useAppSelector(selectPrice(symbol.toUpperCase()));
  const live = useAppSelector(selectLive);
  if (!data) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.priceRow}>
        <span className={styles.tickSlot} />
        <AnimatedPrice value={data.last} className={styles.price} />
        <span className={styles.tickSlot}>
          <PriceTickIndicator price={data.last} />
        </span>
      </div>

      <span className={styles.badge}>
        <span className={live ? styles.dotLive : styles.dot} />
        {live ? 'Live' : 'Connecting…'}
      </span>
    </div>
  );
}
