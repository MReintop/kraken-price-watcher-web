import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import { tickersApplied } from '@/store/pricesSlice';
import CoinPriceRow from './CoinPriceRow';

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

// Arrange helper: render the cell against a store preloaded with the given prices.
const renderWithStore = (
  bySymbol: Record<string, { last: number; changePct: number }>,
) => {
  const store = makeStore({ prices: { bySymbol, status: 'live' } });
  render(
    <Provider store={store}>
      <CoinPriceRow symbol="btc" />
    </Provider>,
  );
  return store;
};

describe('CoinPriceRow', () => {
  it('renders the seeded price and change for its symbol', () => {
    // Arrange / Act
    renderWithStore({ BTC: { last: 62888, changePct: -1.45 } });

    // Assert
    expect(screen.getByText(/62,888/)).toBeInTheDocument();
    expect(screen.getByText(/1\.45%/)).toBeInTheDocument();
  });

  it('re-renders with the new price when a tick for its symbol arrives', () => {
    // Arrange
    const store = renderWithStore({ BTC: { last: 62888, changePct: 1 } });

    // Act
    act(() => {
      store.dispatch(
        tickersApplied([{ symbol: 'BTC', last: 63000, changePct: 2 }]),
      );
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
        <CoinPriceRow symbol="btc" />
      </Provider>,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });
});
