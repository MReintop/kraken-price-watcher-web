'use client';

import { useState } from 'react';
import styles from './PriceTickIndicator.module.css';

export default function PriceTickIndicator({ price }: { price: number }) {
  const [prevPrice, setPrevPrice] = useState(price);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const [tick, setTick] = useState(0);

  if (price !== prevPrice) {
    setPrevPrice(price);
    setDir(price > prevPrice ? 'up' : 'down');
    setTick((n) => n + 1);
  }

  if (!dir) return null;

  return (
    <span
      key={tick}
      className={`${styles.arrow} ${dir === 'up' ? styles.up : styles.down}`}
      aria-hidden="true"
      onAnimationEnd={() => setDir(null)}
    >
      {dir === 'up' ? '▲' : '▼'}
    </span>
  );
}
