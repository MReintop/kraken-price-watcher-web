'use client';

import { useEffect, useRef, useState } from 'react';
import { animateValue } from '@/lib/animate';
import { formatPrice } from '@/lib/format';

interface AnimatedPriceProps {
  value: number;
  className?: string;
  duration?: number;
}

export default function AnimatedPrice({
  value,
  className,
  duration = 1500,
}: AnimatedPriceProps) {
  const [text, setText] = useState(() => formatPrice(value));
  const valueRef = useRef(value); // latest raw (unrounded) value

  // Tweens from the last rendered value, so a tick arriving mid-animation
  // re-targets instead of jumping.
  useEffect(() => {
    if (valueRef.current === value) return;

    return animateValue({
      from: valueRef.current,
      to: value,
      duration,
      onFrame: (current) => {
        valueRef.current = current;
        const next = formatPrice(current);
        setText((prev) => (prev === next ? prev : next));
      },
    });
  }, [value, duration]);

  return <span className={className}>{text}</span>;
}
