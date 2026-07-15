import { render, screen } from '@testing-library/react';
import AnimatedPrice from './AnimatedPrice';

describe('AnimatedPrice', () => {
  // The point of the rewrite: a tween put numbers on screen that never traded.
  it('shows the price it was given, with nothing in between', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={62888} />);

    // Act — a tick arrives
    rerender(<AnimatedPrice value={63000} />);

    // Assert — the new price, not a value part-way to it
    expect(screen.getByText('$63,000')).toBeInTheDocument();
    expect(screen.queryByText('$62,888')).not.toBeInTheDocument();
  });

  it('flashes up when the price rises', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} />);

    // Act
    rerender(<AnimatedPrice value={101} />);

    // Assert — next/jest maps CSS-module classes to their own names
    expect(screen.getByText('$101.00')).toHaveClass('up');
  });

  it('flashes down when the price falls', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} />);

    // Act
    rerender(<AnimatedPrice value={99} />);

    // Assert
    expect(screen.getByText('$99.00')).toHaveClass('down');
  });

  it('does not flash on a repeat trade at the same price', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} />);

    // Act — the same price again, which is common at one level
    rerender(<AnimatedPrice value={100} />);

    // Assert
    const price = screen.getByText('$100.00');
    expect(price).not.toHaveClass('up');
    expect(price).not.toHaveClass('down');
  });

  it('keeps the class it was given', () => {
    // Arrange / Act
    render(<AnimatedPrice value={100} className="price" />);

    // Assert
    expect(screen.getByText('$100.00')).toHaveClass('price');
  });
});
