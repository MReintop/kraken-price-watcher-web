'use client';

import { useAppSelector } from '@/store/hooks';
import {
  selectSocketStatus,
  selectIsUnavailable,
  selectPrice,
  type SocketStatus,
} from '@/store/pricesSlice';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import PriceTickIndicator from '@/components/priceTickIndicator/PriceTickIndicator';
import styles from './CoinPriceHeader.module.css';

// "Not updating" and "Not available" are the two worth spelling out: the socket
// is open and this price is old — either because nothing is arriving at all, or
// because Kraken never agreed to send this one. A Live badge covers both.
const STATUS_LABEL: Record<SocketStatus | 'unavailable', string> = {
  connecting: 'Connecting…',
  live: 'Live',
  stale: 'Not updating',
  offline: 'Reconnecting…',
  unavailable: 'Not available',
};

interface CoinPriceHeaderProps {
  symbol: string;
}

export default function CoinPriceHeader({ symbol }: CoinPriceHeaderProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const socketStatus = useAppSelector(selectSocketStatus);
  const unavailable = useAppSelector(selectIsUnavailable(symbol.toUpperCase()));
  if (price == null) return null;

  // The feed can be live and this instrument still not on it. A global "Live"
  // over a price Kraken never agreed to send is the lie worth catching here.
  const status: SocketStatus | 'unavailable' = unavailable
    ? 'unavailable'
    : socketStatus;

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
