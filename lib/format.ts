// Pinned rather than the runtime default: the server formats in Node's locale
// and the browser in the visitor's, so an unpinned locale renders different text
// on each and mismatches on hydration.
const LOCALE = 'en-US';

// Decimals are the market's, passed in from Kraken's reference data — never
// inferred from the number. Magnitude cannot know that BTC/USD trades to a tenth
// of a dollar: it only knows the price is large, and rounds a real trade at
// 62,888.4 to 62,888. Counting the decimals of the value that arrived is no
// better, because it would render the same market to a different precision on
// every tick that happened to land on a round number.
export function formatPrice(n: number, decimals: number): string {
  return `$${n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatSignedPct(pct: number): string {
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`;
}
