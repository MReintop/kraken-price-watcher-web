import { fireEvent, render, screen } from '@testing-library/react';
import AnimatedPrice from './AnimatedPrice';

describe('AnimatedPrice', () => {
  // The point of the rewrite: a tween put numbers on screen that never traded.
  it('shows the price it was given, with nothing in between', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={62888} decimals={1} />);

    // Act — a tick arrives
    rerender(<AnimatedPrice value={63000} decimals={1} />);

    // Assert — the new price, not a value part-way to it
    expect(screen.getByText('$63,000.0')).toBeInTheDocument();
    expect(screen.queryByText('$62,888.0')).not.toBeInTheDocument();
  });

  it('flashes up when the price rises', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} decimals={2} />);

    // Act
    rerender(<AnimatedPrice value={101} decimals={2} />);

    // Assert — next/jest maps CSS-module classes to their own names
    expect(screen.getByText('$101.00')).toHaveClass('up');
  });

  it('flashes down when the price falls', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} decimals={2} />);

    // Act
    rerender(<AnimatedPrice value={99} decimals={2} />);

    // Assert
    expect(screen.getByText('$99.00')).toHaveClass('down');
  });

  it('does not flash on a repeat trade at the same price', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} decimals={2} />);

    // Act — the same price again, which is common at one level
    rerender(<AnimatedPrice value={100} decimals={2} />);

    // Assert
    const price = screen.getByText('$100.00');
    expect(price).not.toHaveClass('up');
    expect(price).not.toHaveClass('down');
  });

  // Left on, the tint would still be there at the next tick, and a price that
  // rose an hour ago would read as one that just did.
  it('drops the flash once the animation has run', () => {
    // Arrange
    const { rerender } = render(<AnimatedPrice value={100} decimals={2} />);
    rerender(<AnimatedPrice value={101} decimals={2} />);
    const price = screen.getByText('$101.00');
    expect(price).toHaveClass('up');

    // Act — jsdom runs no animations, so the browser's event is the stand-in
    fireEvent.animationEnd(price);

    // Assert
    expect(screen.getByText('$101.00')).not.toHaveClass('up');
  });

  it('keeps the class it was given', () => {
    // Arrange / Act
    render(<AnimatedPrice value={100} decimals={2} className="price" />);

    // Assert
    expect(screen.getByText('$100.00')).toHaveClass('price');
  });
});
