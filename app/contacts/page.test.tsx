import { render, screen } from '@testing-library/react';
import ContactsPage from './page';

// A sync Server Component, so RTL renders it with no special handling.
describe('ContactsPage', () => {
  it('renders its heading', () => {
    // Arrange / Act
    render(<ContactsPage />);

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Contacts' }),
    ).toBeInTheDocument();
  });

  it('shows contact details', () => {
    // Arrange / Act
    render(<ContactsPage />);

    // Assert
    expect(screen.getByText(/support@example\.com/)).toBeInTheDocument();
  });
});
