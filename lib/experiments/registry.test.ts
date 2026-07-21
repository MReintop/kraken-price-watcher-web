import { CHANGE_PILL_STYLE, assignVariant } from './index';

describe('the experiment registry', () => {
  it('puts the shipped behaviour first, so control is never a treatment', () => {
    // Arrange / Act
    const [control, ...treatments] = CHANGE_PILL_STYLE.variants;

    // Assert — index 0 is the control *convention*, not a fallback assignVariant
    // applies: it hashes every id. What this pins is that a registry listing
    // 'arrow' first would make the treatment the thing called control everywhere
    expect(control).toBe('control');
    expect(treatments).toEqual(['arrow']);
  });

  it('only ever returns a variant it declared', () => {
    // Arrange
    const declared = new Set<string>(CHANGE_PILL_STYLE.variants);

    // Act
    const assigned = Array.from({ length: 500 }, (_, i) =>
      assignVariant(`user-${i}`, CHANGE_PILL_STYLE),
    );

    // Assert
    expect(assigned.every((variant) => declared.has(variant))).toBe(true);
  });

  // Golden fixtures, and the point of them is that they are arbitrary: the hash,
  // the delimiter, the bucket maths and the variant order all feed this answer,
  // and any of them changing silently reassigns everyone mid-experiment. If this
  // fails, the fix is a new `_v2` key, not a new expectation.
  it('assigns the same ids to the same variants it always has', () => {
    // Arrange / Act / Assert
    expect(assignVariant('known-unit-1', CHANGE_PILL_STYLE)).toBe('arrow');
    expect(assignVariant('known-unit-2', CHANGE_PILL_STYLE)).toBe('control');
    expect(assignVariant('known-unit-3', CHANGE_PILL_STYLE)).toBe('arrow');
    expect(assignVariant('known-unit-4', CHANGE_PILL_STYLE)).toBe('control');
  });

  it('versions the key, because the key is the salt', () => {
    // Arrange / Act / Assert — an unversioned key has no way to say "this is a
    // different experiment now" and would reassign users in place
    expect(CHANGE_PILL_STYLE.key).toMatch(/_v\d+$/);
  });
});
