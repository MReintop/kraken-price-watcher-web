import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import {
  tickersApplied,
  socketStatusChanged,
  type SocketStatus,
} from '@/store/pricesSlice';
import CoinPriceHeader from './CoinPriceHeader';

// Arrange helper: render the header against a real store in a known state.
const renderWithStore = (
  bySymbol: Record<string, number>,
  status: SocketStatus = 'connecting',
) => {
  const store = makeStore({ prices: { bySymbol, status, unavailable: [] } });
  render(
    <Provider store={store}>
      <CoinPriceHeader symbol="btc" />
    </Provider>,
  );
  return store;
};

describe('CoinPriceHeader', () => {
  it('renders the seeded price for its symbol', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 });

    // Assert
    expect(screen.getByText('$62,888')).toBeInTheDocument();
  });

  it('reads as connecting until the socket reports itself live', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, 'connecting');

    // Assert
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('switches to live when the socket connects', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 });

    // Act
    act(() => {
      store.dispatch(socketStatusChanged('live'));
    });

    // Assert
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  // The state the old boolean could not express: connected, and lying.
  it('says so when the feed stops updating, rather than still reading live', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 }, 'live');

    // Act — the socket is still open, but nothing has arrived for a long time
    act(() => {
      store.dispatch(socketStatusChanged('stale'));
    });

    // Assert
    expect(screen.getByText('Not updating')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('reads as reconnecting once the socket drops', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 }, 'live');

    // Act
    act(() => {
      store.dispatch(socketStatusChanged('offline'));
    });

    // Assert
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  // The feed can be live and this instrument still not on it. A global status
  // has no way to say that, which is why the refused symbols are named.
  it('does not read live for a symbol Kraken refused, while the feed is live', () => {
    // Arrange
    const store = makeStore({
      prices: {
        bySymbol: { BTC: 62888 },
        status: 'live',
        unavailable: ['BTC'],
      },
    });

    // Act
    render(
      <Provider store={store}>
        <CoinPriceHeader symbol="btc" />
      </Provider>,
    );

    // Assert — the socket is live; this price is not
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('reads live for a symbol Kraken did accept', () => {
    // Arrange
    const store = makeStore({
      prices: {
        bySymbol: { BTC: 62888 },
        status: 'live',
        unavailable: ['ETH'],
      },
    });

    // Act
    render(
      <Provider store={store}>
        <CoinPriceHeader symbol="btc" />
      </Provider>,
    );

    // Assert — a neighbour's rejection is not this row's problem
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows the new price when a tick for its symbol arrives', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 });

    // Act
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'BTC', last: 63000 }]));
    });

    // Assert
    expect(screen.getByText('$63,000')).toBeInTheDocument();
  });

  it('ignores a tick for a different symbol', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 });

    // Act
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'ETH', last: 4321 }]));
    });

    // Assert
    expect(screen.getByText('$62,888')).toBeInTheDocument();
  });

  it('renders nothing when its symbol is absent from the store', () => {
    // Arrange
    const store = makeStore({
      prices: { bySymbol: {}, status: 'live', unavailable: [] },
    });

    // Act
    const { container } = render(
      <Provider store={store}>
        <CoinPriceHeader symbol="btc" />
      </Provider>,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });
});
