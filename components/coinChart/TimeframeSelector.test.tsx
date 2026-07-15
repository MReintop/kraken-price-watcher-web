import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeframeSelector, { TIMEFRAMES } from './TimeframeSelector';

describe('TimeframeSelector', () => {
  it('offers every timeframe as a button', () => {
    // Arrange / Act
    render(<TimeframeSelector value={30} onChange={jest.fn()} />);

    // Assert
    for (const timeframe of TIMEFRAMES) {
      expect(
        screen.getByRole('button', { name: timeframe.label }),
      ).toBeInTheDocument();
    }
  });

  it('marks the selected timeframe pressed and the others not', () => {
    // Arrange / Act
    render(<TimeframeSelector value={30} onChange={jest.fn()} />);

    // Assert — aria-pressed is what a screen reader (and the e2e suite) reads
    expect(screen.getByRole('button', { name: '1M' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '24H' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the days value of the clicked timeframe', async () => {
    // Arrange
    const onChange = jest.fn();
    render(<TimeframeSelector value={30} onChange={onChange} />);

    // Act
    await userEvent.click(screen.getByRole('button', { name: '1Y' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(365);
  });

  it('still reports a click on the already-selected timeframe', async () => {
    // Arrange — de-duping is CoinChart's job, not this component's
    const onChange = jest.fn();
    render(<TimeframeSelector value={30} onChange={onChange} />);

    // Act
    await userEvent.click(screen.getByRole('button', { name: '1M' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(30);
  });
});
