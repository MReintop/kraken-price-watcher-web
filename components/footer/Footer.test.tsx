import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Footer from './Footer';

// Stubbed so the test decides which route is current.
jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));
const mockUsePathname = usePathname as jest.Mock;

describe('Footer', () => {
  it('marks the route it is on as active', () => {
    // Arrange
    mockUsePathname.mockReturnValue('/');

    // Act
    render(<Footer />);

    // Assert — next/jest maps CSS-module classes to their own names
    expect(screen.getByRole('link', { name: 'Markets' })).toHaveClass('active');
  });

  it('leaves the link inactive from anywhere else', () => {
    // Arrange
    mockUsePathname.mockReturnValue('/coins/bitcoin');

    // Act
    render(<Footer />);

    // Assert
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
  });
});
