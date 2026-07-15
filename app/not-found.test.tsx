import { render, screen } from '@testing-library/react';
import NotFound from './not-found';

describe('NotFound', () => {
  it('says what happened rather than showing the framework default', () => {
    // Arrange / Act
    render(<NotFound />);

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Not found' }),
    ).toBeInTheDocument();
  });

  // It is reached by typing a URL, so the only way out has to be on the page.
  it('offers a way back to the markets', () => {
    // Arrange / Act
    render(<NotFound />);

    // Assert
    expect(
      screen.getByRole('link', { name: 'Back to markets' }),
    ).toHaveAttribute('href', '/');
  });
});
