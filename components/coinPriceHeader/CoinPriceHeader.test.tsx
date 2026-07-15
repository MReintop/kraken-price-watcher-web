import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import {
  tickersApplied,
  socketStatusChanged,
  type SocketStatus,
} from '@/store/pricesSlice';
import CoinPriceHeader from './CoinPriceHeader';

// Stubbed so AnimatedPrice's tween lands on its final value at once
// (cb(1e6) → t = 1).
const realRaf = global.requestAnimationFrame;
const realCaf = global.cancelAnimationFrame;

beforeEach(() => {
  global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(1e6);
    return 1;
  }) as typeof requestAnimationFrame;
  global.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
});

afterEach(() => {
  global.requestAnimationFrame = realRaf;
  global.cancelAnimationFrame = realCaf;
});

// Arrange helper: render the header against a real store in a known state.
const renderWithStore = (
  bySymbol: Record<string, { last: number; changePct: number }>,
  status: SocketStatus = 'connecting',
) => {
  const store = makeStore({ prices: { bySymbol, status } });
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
    renderWithStore({ BTC: { last: 62888, changePct: -1.45 } });

    // Assert
    expect(screen.getByText('$62,888')).toBeInTheDocument();
  });

  it('reads as connecting until the socket reports itself live', () => {
    // Arrange / Act
    renderWithStore({ BTC: { last: 62888, changePct: 1 } }, 'connecting');

    // Assert
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('switches to live when the socket connects', () => {
    // Arrange
    const store = renderWithStore({ BTC: { last: 62888, changePct: 1 } });

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
    const store = renderWithStore(
      { BTC: { last: 62888, changePct: 1 } },
      'live',
    );

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
    const store = renderWithStore(
      { BTC: { last: 62888, changePct: 1 } },
      'live',
    );

    // Act
    act(() => {
      store.dispatch(socketStatusChanged('offline'));
    });

    // Assert
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('shows the new price when a tick for its symbol arrives', () => {
    // Arrange
    const store = renderWithStore({ BTC: { last: 62888, changePct: 1 } });

    // Act
    act(() => {
      store.dispatch(
        tickersApplied([{ symbol: 'BTC', last: 63000, changePct: 2 }]),
      );
    });

    // Assert
    expect(screen.getByText('$63,000')).toBeInTheDocument();
  });

  it('ignores a tick for a different symbol', () => {
    // Arrange
    const store = renderWithStore({ BTC: { last: 62888, changePct: 1 } });

    // Act
    act(() => {
      store.dispatch(
        tickersApplied([{ symbol: 'ETH', last: 4321, changePct: 9 }]),
      );
    });

    // Assert
    expect(screen.getByText('$62,888')).toBeInTheDocument();
  });

  it('renders nothing when its symbol is absent from the store', () => {
    // Arrange
    const store = makeStore({ prices: { bySymbol: {}, status: 'live' } });

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
