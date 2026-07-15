import { render, screen } from '@testing-library/react';
import MarketSummarySkeleton from './MarketSummarySkeleton';

describe('MarketSummarySkeleton', () => {
  it('announces itself as loading', () => {
    // Arrange / Act
    render(<MarketSummarySkeleton />);

    // Assert
    expect(screen.getByLabelText('Loading summary')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});
