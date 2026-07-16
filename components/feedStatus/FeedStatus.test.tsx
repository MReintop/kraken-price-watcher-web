import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import { socketStatusChanged, type SocketStatus } from '@/store/pricesSlice';
import FeedStatus from './FeedStatus';

const renderWithStatus = (status: SocketStatus) => {
  const store = makeStore({
    prices: { bySymbol: { BTC: 62888 }, status, unavailable: [] },
  });
  render(
    <Provider store={store}>
      <FeedStatus />
    </Provider>,
  );
  return store;
};

describe('FeedStatus', () => {
  it('says nothing while the feed is live', () => {
    // Arrange / Act
    renderWithStatus('live');

    // Assert — a banner over a working feed is noise
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says the feed is not updating when the socket goes silent', () => {
    // Arrange / Act
    renderWithStatus('stale');

    // Assert — the whole list is showing old prices, and this is what says so
    expect(screen.getByText('Not updating')).toBeInTheDocument();
  });

  it('says it is reconnecting once the socket is gone', () => {
    // Arrange / Act
    renderWithStatus('offline');

    // Assert
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('says it is connecting before the feed has been acknowledged', () => {
    // Arrange / Act — the initial handshake, where the prices are server-seeded
    renderWithStatus('connecting');

    // Assert — looking normal here is what makes a dead feed invisible
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  // Added to the DOM alongside its text, the region is not reliably announced —
  // so it is mounted from the start and only its content changes.
  it('keeps one live region mounted across a status change', () => {
    // Arrange
    const store = renderWithStatus('live');
    const region = screen.getByRole('status');

    // Act
    act(() => {
      store.dispatch(socketStatusChanged('offline'));
    });

    // Assert
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Reconnecting…');
  });
});
