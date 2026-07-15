import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorState from './ErrorState';

describe('ErrorState', () => {
  it('says the feed failed, not that the reader did something wrong', () => {
    // Arrange / Act
    render(<ErrorState onRetry={jest.fn()} />);

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Prices are unavailable' }),
    ).toBeInTheDocument();
  });

  // Next's reset() re-renders the segment: without a control for it, an outage
  // that has since passed still needs a manual reload to notice.
  it('offers a retry that runs the caller"s reset', async () => {
    // Arrange
    const onRetry = jest.fn();
    render(<ErrorState onRetry={onRetry} />);

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
