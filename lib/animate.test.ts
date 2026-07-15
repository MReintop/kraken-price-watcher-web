import { easeOutCubic, tweenValueAt } from './animate';

describe('easeOutCubic', () => {
  it('is pinned at 0 and 1', () => {
    // Arrange / Act
    const start = easeOutCubic(0);
    const end = easeOutCubic(1);

    // Assert
    expect(start).toBe(0);
    expect(end).toBe(1);
  });

  it('eases out — over half the distance is covered by the halfway point', () => {
    // Arrange / Act
    const result = easeOutCubic(0.5);

    // Assert
    expect(result).toBeGreaterThan(0.5);
  });
});

describe('tweenValueAt', () => {
  it('starts at `from`', () => {
    // Arrange / Act
    const result = tweenValueAt(100, 200, 0, 1000);

    // Assert
    expect(result).toEqual({ value: 100, done: false });
  });

  it('ends exactly on `to`', () => {
    // Arrange / Act
    const result = tweenValueAt(100, 200, 1000, 1000);

    // Assert
    expect(result).toEqual({ value: 200, done: true });
  });

  it('clamps a late frame to `to` instead of overshooting', () => {
    // Arrange
    const wayPastTheEnd = 99_999;

    // Act
    const result = tweenValueAt(100, 200, wayPastTheEnd, 1000);

    // Assert
    expect(result).toEqual({ value: 200, done: true });
  });

  it('clamps a negative elapsed to `from`', () => {
    // Arrange / Act
    const result = tweenValueAt(100, 200, -50, 1000);

    // Assert
    expect(result).toEqual({ value: 100, done: false });
  });

  it('treats a zero duration as immediately done', () => {
    // Arrange / Act
    const result = tweenValueAt(100, 200, 0, 0);

    // Assert
    expect(result).toEqual({ value: 200, done: true });
  });

  it('sits between `from` and `to` partway through', () => {
    // Arrange / Act
    const result = tweenValueAt(100, 200, 500, 1000);

    // Assert
    expect(result.value).toBeGreaterThan(100);
    expect(result.value).toBeLessThan(200);
    expect(result.done).toBe(false);
  });

  it('runs downward as well as upward', () => {
    // Arrange / Act
    const result = tweenValueAt(200, 100, 1000, 1000);

    // Assert
    expect(result.value).toBe(100);
  });

  it('uses a supplied easing instead of the default', () => {
    // Arrange
    const linear = (t: number) => t;

    // Act
    const result = tweenValueAt(0, 100, 500, 1000, linear);

    // Assert
    expect(result.value).toBe(50);
  });
});
