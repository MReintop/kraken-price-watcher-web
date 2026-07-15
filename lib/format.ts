// Pinned rather than the runtime default: the server formats in Node's locale
// and the browser in the visitor's, so an unpinned locale renders different text
// on each and mismatches on hydration.
const LOCALE = 'en-US';

export function formatPrice(n: number): string {
  return `$${n.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
}
