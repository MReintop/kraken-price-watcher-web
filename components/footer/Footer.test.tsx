import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Footer from './Footer';

// Stubbed so the test decides which route is current.
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));
const mockUsePathname = usePathname as jest.Mock;

describe('Footer', () => {
  it('marks the current route as active and the other as inactive', () => {
    // Arrange
    mockUsePathname.mockReturnValue('/contacts');

    // Act
    render(<Footer />);

    // Assert — next/jest maps CSS-module classes to their own names
    expect(screen.getByRole('link', { name: 'Contacts' })).toHaveClass(
      'active',
    );
    expect(screen.getByRole('link', { name: 'Markets' })).toHaveClass('link');
  });

  it('renders a link for each destination', () => {
    // Arrange
    mockUsePathname.mockReturnValue('/');

    // Act
    render(<Footer />);

    // Assert
    expect(screen.getByRole('link', { name: 'Markets' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Contacts' })).toHaveAttribute(
      'href',
      '/contacts',
    );
  });
});
