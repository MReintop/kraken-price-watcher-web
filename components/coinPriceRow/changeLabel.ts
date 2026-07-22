// Flat is its own direction, not a small gain: this experiment is about how
// direction is presented, and a market that did not move has none to present.
export type PriceDirection = 'up' | 'down' | 'flat';

export const priceDirection = (changePct: number): PriceDirection =>
  changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat';

// Decorative, and rendered aria-hidden: the sign in the text already says which
// way the market went, so flat gets no glyph rather than a neutral one.
const GLYPH: Record<PriceDirection, string> = {
  up: '▲',
  down: '▼',
  flat: '',
};

export const directionGlyph = (direction: PriceDirection): string =>
  GLYPH[direction];

export function formatChangePercent(changePct: number | null): string {
  if (changePct == null) return '—';
  // Only a gain is signed — a loss brings its own minus, and '+0.00%' would
  // read as a market that went up.
  return `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`;
}
