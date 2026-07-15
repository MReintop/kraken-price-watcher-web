import { render, screen } from '@testing-library/react';
import MarketsSkeleton from './MarketsSkeleton';

describe('MarketsSkeleton', () => {
  it('announces itself as loading', () => {
    // Arrange / Act
    render(<MarketsSkeleton />);

    // Assert
    expect(screen.getByLabelText('Loading markets')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('reserves a row per coin, so the list does not jump when data lands', () => {
    // Arrange / Act
    render(<MarketsSkeleton />);

    // Assert
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });
});
