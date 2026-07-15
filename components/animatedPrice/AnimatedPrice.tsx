'use client';

import { useEffect, useRef, useState } from 'react';
import { animateValue } from '@/lib/animate';

const formatPrice = (n: number) =>
  `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AnimatedPrice({
  value,
  className,
  duration = 1500,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
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
