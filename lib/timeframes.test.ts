import { TIMEFRAMES, timeframeFor } from './timeframes';

describe('timeframeFor', () => {
  it('resolves a supported timeframe to its label and fetch geometry', () => {
    // Arrange / Act
    const result = timeframeFor(30);

    // Assert
    expect(result).toEqual({
      days: 30,
      label: '1M',
      interval: 1440,
      points: 30,
    });
  });

  // The reason the table is one row per timeframe: an unsupported value has to
  // be distinguishable, not quietly answered with another timeframe's data.
  it('returns undefined for a timeframe it does not support', () => {
    // Arrange / Act
    const result = timeframeFor(7);

    // Assert
    expect(result).toBeUndefined();
  });

  it('resolves every timeframe the UI can offer', () => {
    // Arrange / Act
    const resolved = TIMEFRAMES.map((timeframe) =>
      timeframeFor(timeframe.days),
    );

    // Assert
    expect(resolved).toEqual([...TIMEFRAMES]);
  });
});
