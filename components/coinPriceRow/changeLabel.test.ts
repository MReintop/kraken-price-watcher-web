import {
  directionGlyph,
  formatChangePercent,
  priceDirection,
} from './changeLabel';

describe('priceDirection', () => {
  it('separates a flat market from a gain', () => {
    // Arrange / Act / Assert — zero is a market that did not move, and this
    // experiment is about how direction reads
    expect(priceDirection(2.5)).toBe('up');
    expect(priceDirection(-1.45)).toBe('down');
    expect(priceDirection(0)).toBe('flat');
  });
});

describe('directionGlyph', () => {
  it('points the arrow the way the number went, and gives flat none', () => {
    // Arrange / Act / Assert
    expect(directionGlyph('up')).toBe('▲');
    expect(directionGlyph('down')).toBe('▼');
    expect(directionGlyph('flat')).toBe('');
  });
});

describe('formatChangePercent', () => {
  it('signs a gain and leaves a loss its own minus', () => {
    // Arrange / Act / Assert — a hand-written '-' would render '--1.45%'
    expect(formatChangePercent(2.5)).toBe('+2.50%');
    expect(formatChangePercent(-1.45)).toBe('-1.45%');
  });

  it('leaves a flat market unsigned', () => {
    // Arrange / Act / Assert — '+0.00%' claims a rise that did not happen
    expect(formatChangePercent(0)).toBe('0.00%');
  });

  it('says nothing when there is no change to report', () => {
    // Arrange / Act / Assert — an em dash, because a number here would invent
    // data the upstream did not have
    expect(formatChangePercent(null)).toBe('—');
  });
});
