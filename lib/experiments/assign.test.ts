import { hashToBucket, assignVariant, type Experiment } from './assign';

const AB = {
  key: 'demo_ab',
  variants: ['control', 'treatment'],
} as const satisfies Experiment;

describe('assignVariant', () => {
  it('is stable: the same user always gets the same variant', () => {
    // Arrange
    const user = 'user-42';

    // Act — assign a thousand times, as if across a thousand sessions
    const results = new Set(
      Array.from({ length: 1000 }, () => assignVariant(user, AB)),
    );

    // Assert — one and only one variant, every time
    expect(results.size).toBe(1);
  });

  it('is independent across experiments (the salt does its job)', () => {
    // Arrange — one user, many experiment keys
    const user = 'user-42';
    const keys = Array.from({ length: 20 }, (_, i) => `exp_${i}`);

    // Act — the bucket this user lands in, per experiment
    const buckets = keys.map((key) => hashToBucket(user, key));

    // Assert — a user is not pinned to one side of every experiment they enter,
    // which is what a salt that did nothing would produce
    expect(new Set(buckets).size).toBeGreaterThan(1);
    expect(
      new Set(keys.map((key) => assignVariant(user, { ...AB, key }))).size,
    ).toBe(2);
  });

  it('splits an even population roughly in half (SRM sanity)', () => {
    // Arrange — 10k distinct users
    const N = 10_000;

    // Act — count how many land in the first variant
    let control = 0;
    for (let i = 0; i < N; i++) {
      if (assignVariant(`user-${i}`, AB) === 'control') control++;
    }

    // Assert — within 3 percentage points of a perfect half
    const share = control / N;
    expect(share).toBeGreaterThan(0.47);
    expect(share).toBeLessThan(0.53);
  });
});

describe('hashToBucket', () => {
  it('always lands in the 0..9999 range', () => {
    // Arrange
    const inputs = ['', 'a', 'user-42', '🚀', 'x'.repeat(1000)];

    // Act / Assert
    for (const id of inputs) {
      const b = hashToBucket(id, 'salt');
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(10_000);
    }
  });
});
