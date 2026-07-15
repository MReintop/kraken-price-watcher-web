import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import { tickersApplied } from '@/store/pricesSlice';
import CoinPriceRow from './CoinPriceRow';

// Arrange helper: the price comes from the store, the change from a prop —
// which is the split under test as much as anything else here.
const renderWithStore = (
  bySymbol: Record<string, number>,
  changePct: number | null = -1.45,
  unavailable: string[] = [],
) => {
  const store = makeStore({
    prices: { bySymbol, status: 'live', unavailable },
  });
  render(
    <Provider store={store}>
      <CoinPriceRow symbol="btc" changePct={changePct} />
    </Provider>,
  );
  return store;
};

describe('CoinPriceRow', () => {
  // No test here that a tick leaves the 24h change alone: `changePct` is a prop,
  // so no tick can reach it whether the code is right or wrong, and a test that
  // passes either way certifies nothing. The guard is in
  // store/krakenSocket.test.ts, where a frame's change_pct can actually try to
  // get into a dispatch.
  // This is the screen people watch. A price Kraken refused looks exactly like a
  // live one here — the coin's own page said so, this one did not.
  it('says when a price is not updating, rather than showing it as live', () => {
    // Arrange / Act — the feed is live; Kraken just refused this symbol
    renderWithStore({ BTC: 62888 }, -1.45, ['BTC']);

    // Assert
    expect(screen.getByText('Not updating')).toBeInTheDocument();
  });

  it('says nothing of the sort for a symbol that is ticking', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, -1.45, ['ETH']);

    // Assert — a neighbour's rejection is not this row's problem
    expect(screen.queryByText('Not updating')).not.toBeInTheDocument();
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
    const store = makeStore({
      prices: { bySymbol: {}, status: 'live', unavailable: [] },
    });

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
