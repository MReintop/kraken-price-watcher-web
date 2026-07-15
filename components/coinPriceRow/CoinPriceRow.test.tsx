import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import { tickersApplied } from '@/store/pricesSlice';
import CoinPriceRow from './CoinPriceRow';

// Arrange helper: the price comes from the store, the change from a prop —
// which is the split under test as much as anything else here.
const renderWithStore = (
  bySymbol: Record<string, number>,
  changePct = -1.45,
) => {
  const store = makeStore({ prices: { bySymbol, status: 'live' } });
  render(
    <Provider store={store}>
      <CoinPriceRow symbol="btc" changePct={changePct} />
    </Provider>,
  );
  return store;
};

describe('CoinPriceRow', () => {
  // Documents the split rather than defends it: the change is a prop, so a tick
  // has no way to reach it and this cannot fail while that holds. What defends
  // it is store/krakenSocket.test.ts, where a frame's change_pct can actually
  // try to get into a dispatch.
  it('shows a change the price ticks cannot reach', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 }, -1.45);

    // Act
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'BTC', last: 63000 }]));
    });

    // Assert — new price from Kraken, the change still CoinGecko's
    expect(screen.getByText(/63,000/)).toBeInTheDocument();
    expect(screen.getByText(/1\.45%/)).toBeInTheDocument();
  });

  it('renders the seeded price and change for its symbol', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 });

    // Assert
    expect(screen.getByText(/62,888/)).toBeInTheDocument();
    expect(screen.getByText(/1\.45%/)).toBeInTheDocument();
  });

  it('re-renders with the new price when a tick for its symbol arrives', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 });

    // Act
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'BTC', last: 63000 }]));
    });

    // Assert
    expect(screen.getByText(/63,000/)).toBeInTheDocument();
  });

  it('renders nothing when its symbol is absent from the store', () => {
    // Arrange
    const store = makeStore({ prices: { bySymbol: {}, status: 'live' } });

    // Act
    const { container } = render(
      <Provider store={store}>
        <CoinPriceRow symbol="btc" changePct={1} />
      </Provider>,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });
});
