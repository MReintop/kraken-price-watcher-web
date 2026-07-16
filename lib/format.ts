// Pinned rather than the runtime default: the server formats in Node's locale
// and the browser in the visitor's, so an unpinned locale renders different text
// on each and mismatches on hydration.
const LOCALE = 'en-US';

// Decimals come from the market (Kraken pair_decimals), never from magnitude:
// magnitude rounds a real 62,888.4 trade to 62,888. Counting the arrived value's
// own decimals is no better — it drifts precision on every round-numbered tick.
export function formatPrice(n: number, decimals: number): string {
  return `$${n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
}
