import { formatPrice, formatSignedPct } from './format';

describe('formatPrice', () => {
  // The headline case, and the one magnitude gets wrong: Kraken quotes BTC/USD
  // to a tenth of a dollar, so this is a trade that really happened.
  it('renders a price at the precision its market trades in', () => {
    // Arrange / Act
    const result = formatPrice(62888.4, 1);

    // Assert — the trade, not a rounder number near it
    expect(result).toBe('$62,888.4');
  });

  it('pads a round trade out to the market precision', () => {
    // Arrange / Act — a trade that landed on a whole dollar
    const result = formatPrice(62888, 1);

    // Assert — a tenth-of-a-dollar market has a tenths column, occupied or not
    expect(result).toBe('$62,888.0');
  });

  it('groups thousands and shows cents for a two-decimal market', () => {
    // Arrange / Act
    const result = formatPrice(1234.5, 2);

    // Assert
    expect(result).toBe('$1,234.50');
  });

  // At two decimals a real tick on a sub-$1 asset moves nothing on screen.
  it('keeps enough precision for a sub-$1 asset to visibly tick', () => {
    // Arrange / Act — a ~2% dogecoin move
    const before = formatPrice(0.0712, 4);
    const after = formatPrice(0.0698, 4);

    // Assert
    expect(before).toBe('$0.0712');
    expect(after).not.toBe(before);
  });

  it('renders a market that trades in whole units without a decimal point', () => {
    // Arrange / Act
    const result = formatPrice(62888, 0);

    // Assert
    expect(result).toBe('$62,888');
  });

  // The size of the number is not evidence about the market it traded on, and
  // deciding by magnitude is what rounded a real 62,888.4 down to 62,888.
  it('lets the market decide the decimals, never the size of the value', () => {
    // Arrange / Act — same market, either side of the magnitude threshold
    const below = formatPrice(9999.99, 2);
    const above = formatPrice(10_000.5, 2);

    // Assert — the larger price keeps its cents
    expect(below).toBe('$9,999.99');
    expect(above).toBe('$10,000.50');
  });

  // The exact-output tests above pass on an en-US runner whether the locale is
  // pinned or not, so they cannot catch a regression to the runtime default.
  // This asserts the argument, which is the thing that breaks hydration.
  it('passes an explicit locale, never the runtime default', () => {
    // Arrange
    const toLocaleString = jest.spyOn(Number.prototype, 'toLocaleString');

    // Act
    formatPrice(1234.5, 2);

    // Assert
    expect(toLocaleString).toHaveBeenCalledWith('en-US', expect.anything());
    toLocaleString.mockRestore();
  });
});

describe('formatSignedPct', () => {
  it('formats a gain with an up arrow', () => {
    // Arrange / Act
    const result = formatSignedPct(2.5);

    // Assert
    expect(result).toBe('▲ 2.50%');
  });

  it('formats a loss with a down arrow and no duplicate minus sign', () => {
    // Arrange / Act
    const result = formatSignedPct(-2.5);

    // Assert
    expect(result).toBe('▼ 2.50%');
  });

  it('treats zero as a gain', () => {
    // Arrange / Act
    const result = formatSignedPct(0);

    // Assert
    expect(result).toBe('▲ 0.00%');
  });
});
