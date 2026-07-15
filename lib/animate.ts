export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export interface TweenFrame {
  value: number;
  done: boolean;
}

export function tweenValueAt(
  from: number,
  to: number,
  elapsed: number,
  duration: number,
  easing: (t: number) => number = easeOutCubic,
): TweenFrame {
  const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration));
  return { value: from + (to - from) * easing(t), done: t >= 1 };
}

export interface AnimateValueOptions {
  from: number;
  to: number;
  duration: number;
  onFrame: (value: number) => void;
  easing?: (t: number) => number;
}

export function animateValue({
  from,
  to,
  duration,
  onFrame,
  easing = easeOutCubic,
}: AnimateValueOptions): () => void {
  const start = performance.now();
  let raf = 0;

  const step = (now: number) => {
    const { value, done } = tweenValueAt(
      from,
      to,
      now - start,
      duration,
      easing,
    );
    onFrame(value);
    if (!done) raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
