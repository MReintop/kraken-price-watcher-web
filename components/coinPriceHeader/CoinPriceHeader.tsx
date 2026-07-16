'use client';

import { useAppSelector } from '@/store/hooks';
import { selectEffectiveStatus, selectPrice } from '@/store/pricesSlice';
import { STATUS_LABEL } from '@/lib/feedStatus';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import PriceTickIndicator from '@/components/priceTickIndicator/PriceTickIndicator';
import styles from './CoinPriceHeader.module.css';

interface CoinPriceHeaderProps {
  symbol: string;
}

export default function CoinPriceHeader({ symbol }: CoinPriceHeaderProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const status = useAppSelector(selectEffectiveStatus(symbol.toUpperCase()));
  if (price == null) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.priceRow}>
        <span className={styles.tickSlot} />
        <AnimatedPrice value={price} className={styles.price} />
        <span className={styles.tickSlot}>
          <PriceTickIndicator price={price} />
        </span>
      </div>

      {/* Announced, unlike the price: the feed dying is news, and it changes
          rarely enough not to talk over anyone. Rapid ticks would. */}
      <span className={styles.badge} role="status">
        <span className={status === 'live' ? styles.dotLive : styles.dot} />
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}
