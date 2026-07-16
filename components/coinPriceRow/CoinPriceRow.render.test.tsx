import { Profiler } from 'react';
import { render, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import { tickersApplied } from '@/store/pricesSlice';
import CoinPriceRow from './CoinPriceRow';

// Arrange helper: two rows, each counting its own renders.
const renderTwoRows = () => {
  const renders = { BTC: 0, ETH: 0 };
  const store = makeStore({
    prices: {
      bySymbol: { BTC: 62888, ETH: 1883 },
      status: 'live',
      unavailable: [],
    },
  });

  render(
    <Provider store={store}>
      <Profiler id="BTC" onRender={() => (renders.BTC += 1)}>
        <CoinPriceRow priceDecimals={2} symbol="btc" changePct={1} />
      </Profiler>
      <Profiler id="ETH" onRender={() => (renders.ETH += 1)}>
        <CoinPriceRow priceDecimals={2} symbol="eth" changePct={1} />
      </Profiler>
    </Provider>,
  );

  return { store, renders };
};

describe('CoinPriceRow re-render isolation', () => {
  it('re-renders only the row whose symbol ticked', () => {
    // Arrange
    const { store, renders } = renderTwoRows();
    const before = { ...renders };

    // Act
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'BTC', last: 63000 }]));
    });

    // Assert — the untouched row must not pay for its neighbour's tick
    expect(renders.BTC).toBeGreaterThan(before.BTC);
    expect(renders.ETH).toBe(before.ETH);
  });

  it('re-renders both rows only when both ticked', () => {
    // Arrange
    const { store, renders } = renderTwoRows();
    const before = { ...renders };

    // Act
    act(() => {
      store.dispatch(
        tickersApplied([
          { symbol: 'BTC', last: 63000 },
          { symbol: 'ETH', last: 1900 },
        ]),
      );
    });

    // Assert
    expect(renders.BTC).toBeGreaterThan(before.BTC);
    expect(renders.ETH).toBeGreaterThan(before.ETH);
  });

  it('re-renders nothing when a tick repeats the current price', () => {
    // Arrange
    const { store, renders } = renderTwoRows();
    const before = { ...renders };

    // Act — same values the store already holds
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'BTC', last: 62888 }]));
    });

    // Assert
    expect(renders.BTC).toBe(before.BTC);
    expect(renders.ETH).toBe(before.ETH);
  });
});
