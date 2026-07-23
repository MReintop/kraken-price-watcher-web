import { createExposureLogger } from './exposure';
import type { ExperimentEvent } from './events';

describe('createExposureLogger', () => {
  it('logs a given user once per experiment, however many reads', () => {
    // Arrange — a spy sink instead of the console
    const events: ExperimentEvent[] = [];
    const log = createExposureLogger((e) => events.push(e));

    // Act — the same user's row renders ten times
    for (let i = 0; i < 10; i++) log('change_pill_style', 'arrow', 'user-42');

    // Assert — exactly one exposure recorded
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      experiment: 'change_pill_style',
      variant: 'arrow',
      unitId: 'user-42',
    });
  });

  it('logs distinct users separately', () => {
    // Arrange
    const events: ExperimentEvent[] = [];
    const log = createExposureLogger((e) => events.push(e));

    // Act
    log('change_pill_style', 'arrow', 'user-1');
    log('change_pill_style', 'control', 'user-2');

    // Assert
    expect(events).toHaveLength(2);
  });
});
