'use client';

import { useAppSelector } from '@/store/hooks';
import {
  selectSocketStatus,
  selectPrice,
  type SocketStatus,
} from '@/store/pricesSlice';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import PriceTickIndicator from '@/components/priceTickIndicator/PriceTickIndicator';
import styles from './CoinPriceHeader.module.css';

// "Stale" is the one worth spelling out: the socket is open and the price on
// screen is old, which is the state a Live badge would lie about.
const STATUS_LABEL: Record<SocketStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  stale: 'Not updating',
  offline: 'Reconnecting…',
};

interface CoinPriceHeaderProps {
  symbol: string;
}

export default function CoinPriceHeader({ symbol }: CoinPriceHeaderProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const status = useAppSelector(selectSocketStatus);
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
