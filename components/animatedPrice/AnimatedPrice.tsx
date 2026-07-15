'use client';

import { useState } from 'react';
import { formatPrice } from '@/lib/format';
import styles from './AnimatedPrice.module.css';

interface AnimatedPriceProps {
  value: number;
  className?: string;
}

// Renders what last traded, immediately. Interpolating between two ticks would
// put a price on screen that no one paid, and at 250ms a tick the tween never
// arrived anyway — it just chased. The flash carries the direction instead: it
// is a cue, so it can lie about nothing.
export default function AnimatedPrice({
  value,
  className,
}: AnimatedPriceProps) {
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  // Remounts the span, which is what restarts a CSS animation already running.
  const [tick, setTick] = useState(0);

  if (value !== previous) {
    setPrevious(value);
    setDirection(value > previous ? 'up' : 'down');
    setTick((n) => n + 1);
  }

  const flash = direction ? styles[direction] : '';

  return (
    <span
      key={tick}
      className={`${className ?? ''} ${flash}`.trim()}
      onAnimationEnd={() => setDirection(null)}
    >
      {formatPrice(value)}
    </span>
  );
}
