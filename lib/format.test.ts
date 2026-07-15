import { formatPrice, formatSignedPct } from './format';

describe('formatPrice', () => {
  it('groups thousands and always shows two decimals', () => {
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
