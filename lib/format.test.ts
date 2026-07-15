import { formatPrice, formatSignedPct } from './format';

describe('formatPrice', () => {
  it('groups thousands and shows cents for a mid-range price', () => {
    // Arrange / Act
    const result = formatPrice(1234.5);

    // Assert
    expect(result).toBe('$1,234.50');
  });

  it('pads a whole number to two decimals', () => {
    // Arrange / Act
    const result = formatPrice(10);

    // Assert
    expect(result).toBe('$10.00');
  });

  // At two decimals a real tick on a sub-$1 asset moves nothing on screen.
  it('keeps enough precision for a sub-$1 asset to visibly tick', () => {
    // Arrange / Act — a ~2% dogecoin move
    const before = formatPrice(0.0712);
    const after = formatPrice(0.0698);

    // Assert
    expect(before).toBe('$0.0712');
    expect(after).not.toBe(before);
  });

  it('drops cents once they are noise', () => {
    // Arrange / Act
    const result = formatPrice(62888);

    // Assert
    expect(result).toBe('$62,888');
  });

  // Decimals follow magnitude, not the value: a tween crossing 9,999.99 -> 10,000
  // would otherwise drop two decimals mid-animation.
  it('does not change decimals for values of the same magnitude', () => {
    // Arrange / Act
    const low = formatPrice(1000.5);
    const high = formatPrice(9999.99);

    // Assert — both two decimals
    expect(low).toBe('$1,000.50');
    expect(high).toBe('$9,999.99');
  });

  // The exact-output tests above pass on an en-US runner whether the locale is
  // pinned or not, so they cannot catch a regression to the runtime default.
  // This asserts the argument, which is the thing that breaks hydration.
  it('passes an explicit locale, never the runtime default', () => {
    // Arrange
    const toLocaleString = jest.spyOn(Number.prototype, 'toLocaleString');

    // Act
    formatPrice(1234.5);

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
