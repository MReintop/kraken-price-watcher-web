import {
  applyLivePrice,
  describeCandles,
  periodChangePct,
  priceDomain,
  computeCandleLayout,
  evenlySpacedIndices,
  priceToY,
  niceTicks,
  formatAxisPrice,
  formatAxisTime,
  type Candle,
} from './candleChart';

const makeCandle = (overrides: Partial<Candle> = {}): Candle => ({
  t: 0,
  o: 100,
  h: 110,
  l: 90,
  c: 105,
  ...overrides,
});

describe('candleChart', () => {
  it('folds the live price into the last candle (close + high/low)', () => {
    // Arrange
    const candles = [makeCandle(), makeCandle({ c: 105, h: 110, l: 90 })];

    // Act
    const result = applyLivePrice(candles, 120);

    // Assert — last candle updates, earlier ones keep their reference
    expect(result[1]).toEqual({ t: 0, o: 100, h: 120, l: 90, c: 120 });
    expect(result[0]).toBe(candles[0]);
  });

  it('computes the period change from first open to last close', () => {
    // Arrange
    const candles = [makeCandle({ o: 100 }), makeCandle({ c: 120 })];

    // Act
    const result = periodChangePct(candles);

    // Assert
    expect(result).toBe(20);
  });

  it('derives the price domain from candle highs and lows', () => {
    // Arrange
    const candles = [
      makeCandle({ h: 110, l: 90 }),
      makeCandle({ h: 130, l: 80 }),
    ];

    // Act
    const result = priceDomain(candles);

    // Assert
    expect(result).toEqual({ min: 80, max: 130 });
  });

  it('lays out one body+wick per candle within the box', () => {
    // Arrange
    const candles = [
      makeCandle({ o: 100, c: 105 }),
      makeCandle({ o: 105, c: 95 }),
    ];

    // Act
    const result = computeCandleLayout(candles, { width: 200, height: 100 });

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].up).toBe(true); // close >= open
    expect(result[1].up).toBe(false);
    expect(result[0].bodyWidth).toBeGreaterThan(0);
  });

  it('picks evenly-spaced label indices including first and last', () => {
    // Arrange / Act
    const result = evenlySpacedIndices(9, 5);

    // Assert
    expect(result).toEqual([0, 2, 4, 6, 8]);
  });
});

describe('describeCandles', () => {
  it('gives the range and the trend, not just the chart type', () => {
    // Arrange — opens at 100, closes at 120, spanning 90 to 130
    const candles = [
      makeCandle({ o: 100, l: 90, h: 110 }),
      makeCandle({ c: 120, l: 95, h: 130 }),
    ];

    // Act
    const result = describeCandles(candles, 30, 2);

    // Assert — a screen reader gets what the shape shows a sighted reader
    expect(result).toBe(
      '30-day candlestick chart, 2 candles. Low $90.00, high $130.00. Up 20.00% over the period.',
    );
  });

  it('says down in words rather than leaning on the arrow', () => {
    // Arrange
    const candles = [makeCandle({ o: 100 }), makeCandle({ c: 80 })];

    // Act
    const result = describeCandles(candles, 1, 2);

    // Assert — "▼" is announced as nothing useful
    expect(result).toContain('Down 20.00% over the period.');
  });

  it('does not claim a range it has no data for', () => {
    // Arrange / Act
    const result = describeCandles([], 365, 2);

    // Assert
    expect(result).toBe('365-day candlestick chart, no data');
  });
});

describe('priceToY', () => {
  it('puts the domain max at the top of the box and the min at the bottom', () => {
    // Arrange
    const domain = { min: 0, max: 100 };

    // Act / Assert — SVG y grows downward, so max maps to 0
    expect(priceToY(100, domain, 200)).toBe(0);
    expect(priceToY(0, domain, 200)).toBe(200);
  });

  it('maps the midpoint to the middle', () => {
    // Arrange / Act
    const result = priceToY(50, { min: 0, max: 100 }, 200);

    // Assert
    expect(result).toBe(100);
  });

  it('does not divide by zero on a flat domain', () => {
    // Arrange / Act — min === max would make the range 0
    const result = priceToY(50, { min: 50, max: 50 }, 200);

    // Assert
    expect(Number.isFinite(result)).toBe(true);
  });

  // Finite is not the same as right: substituting a range of 1 keeps the number
  // real and still draws the flat market along the floor, as if it had crashed.
  it('draws a market that did not move through the middle, not the floor', () => {
    // Arrange — every candle at the same price
    const flat = [
      makeCandle({ o: 100, h: 100, l: 100, c: 100 }),
      makeCandle({ o: 100, h: 100, l: 100, c: 100 }),
    ];

    // Act
    const result = priceToY(100, priceDomain(flat), 200);

    // Assert — centred in the plot, not pinned to its bottom edge
    expect(result).toBeCloseTo(100);
  });
});

describe('niceTicks', () => {
  it('produces round, evenly-spaced ticks spanning the range', () => {
    // Arrange / Act
    const result = niceTicks(0, 100, 5);

    // Assert
    expect(result[0]).toBeLessThanOrEqual(0);
    expect(result[result.length - 1]).toBeGreaterThanOrEqual(100);
    const gaps = result.slice(1).map((t, i) => +(t - result[i]).toFixed(6));
    expect(new Set(gaps).size).toBe(1);
  });

  it('returns a single tick when the range is empty', () => {
    // Arrange / Act
    const result = niceTicks(50, 50);

    // Assert
    expect(result).toEqual([50]);
  });

  it('returns a single tick when max is below min', () => {
    // Arrange / Act
    const result = niceTicks(100, 10);

    // Assert
    expect(result).toEqual([100]);
  });

  it('handles sub-1 ranges without collapsing', () => {
    // Arrange / Act — e.g. cardano at ~$0.38
    const result = niceTicks(0.3, 0.4, 5);

    // Assert
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toBeLessThanOrEqual(0.3);
  });
});

describe('formatAxisPrice', () => {
  it('drops decimals and groups thousands for large prices', () => {
    // Arrange / Act
    const result = formatAxisPrice(62888.4);

    // Assert
    expect(result).toBe('62,888');
  });

  it('keeps two decimals between 1 and 1000', () => {
    // Arrange / Act
    const result = formatAxisPrice(11.3);

    // Assert
    expect(result).toBe('11.30');
  });

  it('keeps significant digits for sub-1 prices', () => {
    // Arrange / Act — 2dp would render $0.38 tokens as "0.38"; precision matters
    const result = formatAxisPrice(0.3812);

    // Assert
    expect(result).toBe('0.381');
  });
});

describe('formatAxisTime', () => {
  // A fixed UTC instant: 2026-01-02T03:04:00Z
  const ts = Date.UTC(2026, 0, 2, 3, 4);

  it('shows HH:mm for the 24H timeframe', () => {
    // Arrange / Act
    const result = formatAxisTime(ts, 1);

    // Assert
    expect(result).toBe('03:04');
  });

  it('shows DD.MM for the 1M timeframe', () => {
    // Arrange / Act
    const result = formatAxisTime(ts, 30);

    // Assert
    expect(result).toBe('02.01');
  });

  it('shows Mon DD for the 1Y timeframe', () => {
    // Arrange / Act
    const result = formatAxisTime(ts, 365);

    // Assert
    expect(result).toBe('Jan 2');
  });

  it('formats in UTC so server and client labels agree', () => {
    // Arrange — a local-time formatter would drift with TZ and break hydration
    const midnightUtc = Date.UTC(2026, 0, 2, 0, 0);

    // Act
    const result = formatAxisTime(midnightUtc, 1);

    // Assert
    expect(result).toBe('00:00');
  });
});
