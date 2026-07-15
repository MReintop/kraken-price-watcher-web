import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import type { Candle } from '@/lib/candleChart';
import CoinChart from './CoinChart';

const makeCandle = (overrides: Partial<Candle> = {}): Candle => ({
  t: Date.UTC(2026, 0, 2),
  o: 100,
  h: 110,
  l: 90,
  c: 105,
  ...overrides,
});

const twoCandles = [makeCandle({ o: 100 }), makeCandle({ c: 105 })];

// Stubbed at `fetch` rather than the module, so the real chartApi still runs.
const mockFetch = (candles: Candle[]) => {
  const mock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ candles }) });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
};

// Arrange helper: render against a real store holding the given live price.
const renderChart = ({
  candles = twoCandles,
  live,
}: { candles?: Candle[]; live?: number } = {}) => {
  const store = makeStore({
    prices: {
      bySymbol: live != null ? { BTC: { last: live, changePct: 1 } } : {},
      status: 'live',
    },
  });
  const view = render(
    <Provider store={store}>
      <CoinChart coinId="bitcoin" symbol="btc" initialCandles={candles} />
    </Provider>,
  );
  return { store, ...view };
};

afterEach(() => jest.resetAllMocks());

describe('CoinChart', () => {
  it('draws the server-seeded candles', () => {
    // Arrange / Act
    const { container } = renderChart();

    // Assert
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });

  it('reports the chart unavailable when there are too few candles to plot', () => {
    // Arrange / Act — a single candle cannot make a series
    renderChart({ candles: [makeCandle()] });

    // Assert
    expect(screen.getByText('Chart unavailable')).toBeInTheDocument();
  });

  it('folds the live price from the store into the last candle', () => {
    // Arrange / Act — first open 100, live 200 → +100% across the series
    renderChart({ candles: twoCandles, live: 200 });

    // Assert
    expect(screen.getByText('▲ 100.00%')).toBeInTheDocument();
  });

  it('shows the period change from the seeded candles when no live price exists', () => {
    // Arrange / Act — first open 100 → last close 105
    renderChart({ candles: twoCandles });

    // Assert
    expect(screen.getByText('▲ 5.00%')).toBeInTheDocument();
  });

  it('fetches and draws the new range when the timeframe changes', async () => {
    // Arrange
    const mock = mockFetch([makeCandle(), makeCandle(), makeCandle()]);
    const { container } = renderChart();

    // Act
    await userEvent.click(screen.getByRole('button', { name: '24H' }));

    // Assert
    await waitFor(() =>
      expect(container.querySelectorAll('rect')).toHaveLength(3),
    );
    expect(mock.mock.calls[0][0]).toBe('/api/chart/bitcoin?days=1');
  });

  it('marks the newly chosen timeframe as selected', async () => {
    // Arrange
    mockFetch([makeCandle(), makeCandle()]);
    renderChart();

    // Act
    await userEvent.click(screen.getByRole('button', { name: '1Y' }));

    // Assert
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '1Y' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('does not refetch when the current timeframe is clicked again', async () => {
    // Arrange
    const mock = mockFetch([makeCandle(), makeCandle()]);
    renderChart();

    // Act — 1M is already the default
    await userEvent.click(screen.getByRole('button', { name: '1M' }));

    // Assert
    expect(mock).not.toHaveBeenCalled();
  });

  it('reports the chart unavailable when the fetch fails', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    renderChart();

    // Act
    await userEvent.click(screen.getByRole('button', { name: '24H' }));

    // Assert
    expect(await screen.findByText('Chart unavailable')).toBeInTheDocument();
  });
});
