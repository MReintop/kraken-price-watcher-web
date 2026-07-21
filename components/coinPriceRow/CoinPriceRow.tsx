'use client';

import { useAppSelector } from '@/store/hooks';
import { selectEffectiveStatus, selectPrice } from '@/store/pricesSlice';
import { isPriceCurrent, STATUS_LABEL } from '@/lib/feedStatus';
import AnimatedPrice from '@/components/animatedPrice/AnimatedPrice';
import type { ChangePillVariant } from '@/lib/experiments';

import styles from './CoinPriceRow.module.css';
import {
  directionGlyph,
  formatChangePercent,
  priceDirection,
} from './changeLabel';

interface CoinPriceRowProps {
  symbol: string;
  priceDecimals: number;
  changePct24H: number | null;
  changePillVariant: ChangePillVariant;
}

const PILL_CLASS = {
  up: styles.pillUp,
  down: styles.pillDown,
  flat: styles.pillFlat,
};

export default function CoinPriceRow({
  symbol,
  priceDecimals,
  changePct24H,
  changePillVariant,
}: CoinPriceRowProps) {
  const price = useAppSelector(selectPrice(symbol.toUpperCase()));
  const status = useAppSelector(selectEffectiveStatus(symbol.toUpperCase()));
  if (price == null) return <></>;

  // No figure and no movement both get the neutral pill: neither is a direction.
  const direction =
    changePct24H == null ? 'flat' : priceDirection(changePct24H);
  const glyph = directionGlyph(direction);

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
          className={`${styles.pill} ${PILL_CLASS[direction]}`}
          title="24h change across exchanges, from CoinGecko"
        >
          {/* Outside the text, and hidden: the treatment is meant to change what
              the pill looks like, not what a screen reader reads out. */}
          {changePillVariant === 'arrow' && glyph && (
            <span aria-hidden="true">{glyph}</span>
          )}
          <span>{formatChangePercent(changePct24H)}</span>
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
