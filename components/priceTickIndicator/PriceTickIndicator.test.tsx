import { render, screen, fireEvent } from '@testing-library/react';
import PriceTickIndicator from './PriceTickIndicator';

const arrow = () => screen.queryByText(/[▲▼]/);

describe('PriceTickIndicator', () => {
  it('shows nothing until the price moves', () => {
    // Arrange / Act — the first render establishes a baseline, not a tick
    render(<PriceTickIndicator price={100} />);

    // Assert
    expect(arrow()).not.toBeInTheDocument();
  });

  it('blinks an up arrow when the price rises', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);

    // Act
    rerender(<PriceTickIndicator price={101} />);

    // Assert
    expect(screen.getByText('▲')).toBeInTheDocument();
  });

  it('blinks a down arrow when the price falls', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);

    // Act
    rerender(<PriceTickIndicator price={99} />);

    // Assert
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('stays silent when the price is unchanged', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);

    // Act — a tick that repeats the same price is not a move
    rerender(<PriceTickIndicator price={100} />);

    // Assert
    expect(arrow()).not.toBeInTheDocument();
  });

  it('flips direction when the price reverses', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);
    rerender(<PriceTickIndicator price={101} />);

    // Act
    rerender(<PriceTickIndicator price={100} />);

    // Assert
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('unmounts the arrow once its fade finishes', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);
    rerender(<PriceTickIndicator price={101} />);

    // Act — the CSS animation never runs in jsdom, so fire its end event
    fireEvent.animationEnd(screen.getByText('▲'));

    // Assert
    expect(arrow()).not.toBeInTheDocument();
  });

  it('is hidden from screen readers', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);

    // Act
    rerender(<PriceTickIndicator price={101} />);

    // Assert — decorative: the price itself already announces the change
    expect(screen.getByText('▲')).toHaveAttribute('aria-hidden', 'true');
  });

  it('replays the arrow on each successive rise', () => {
    // Arrange
    const { rerender } = render(<PriceTickIndicator price={100} />);
    rerender(<PriceTickIndicator price={101} />);
    const first = screen.getByText('▲');

    // Act — the changing key must remount the span so the fade restarts
    rerender(<PriceTickIndicator price={102} />);

    // Assert
    expect(screen.getByText('▲')).not.toBe(first);
  });
});
