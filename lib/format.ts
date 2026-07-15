// Pinned rather than the runtime default: the server formats in Node's locale
// and the browser in the visitor's, so an unpinned locale renders different text
// on each and mismatches on hydration.
const LOCALE = 'en-US';

// Decimals by magnitude, not a flat 2: at two decimals a real DOGE or ADA tick
// moves nothing on screen. Keyed to magnitude rather than the exact value, so an
// animating number cannot flicker its decimal places mid-tween.
export function formatPrice(n: number): string {
  const decimals = n >= 10_000 ? 0 : n >= 1 ? 2 : 4;
  return `$${n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
}
