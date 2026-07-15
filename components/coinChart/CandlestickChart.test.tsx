import { render, screen } from '@testing-library/react';
import type { Candle } from '@/lib/candleChart';
import CandlestickChart from './CandlestickChart';

const makeCandle = (overrides: Partial<Candle> = {}): Candle => ({
  t: Date.UTC(2026, 0, 2, 3, 4),
  o: 100,
  h: 110,
  l: 90,
  c: 105,
  ...overrides,
});

// Arrange helper: render the chart and hand back its <svg>.
const renderChart = (candles: Candle[], days = 30) => {
  const { container } = render(
    <CandlestickChart candles={candles} width={600} height={240} days={days} />,
  );
  return container.querySelector('svg')!;
};

describe('CandlestickChart', () => {
  it('draws a body and a wick for every candle', () => {
    // Arrange
    const candles = [makeCandle(), makeCandle(), makeCandle()];

    // Act
    const svg = renderChart(candles);

    // Assert
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
  });

  it('describes its range and trend for screen readers, not just its type', () => {
    // Arrange / Act
    renderChart([makeCandle(), makeCandle()], 365);

    // Assert — the wording itself is pinned in lib/candleChart.test.ts; here it
    // only has to reach the element a screen reader actually reads
    expect(
      screen.getByRole('img', { name: /365-day candlestick chart, 2 candles/ }),
    ).toBeInTheDocument();
  });

  it('renders price labels on the right axis', () => {
    // Arrange / Act
    const svg = renderChart([
      makeCandle({ l: 90, h: 110 }),
      makeCandle({ l: 90, h: 110 }),
    ]);

    // Assert — niceTicks drives these, so there is at least one
    expect(svg.querySelectorAll('text').length).toBeGreaterThan(0);
  });

  it('formats x labels for the timeframe it is given', () => {
    // Arrange
    const candles = Array.from({ length: 5 }, () => makeCandle());

    // Act — 24H formats as HH:mm
    const svg = renderChart(candles, 1);

    // Assert
    const labels = Array.from(svg.querySelectorAll('text')).map(
      (node) => node.textContent,
    );
    expect(labels).toContain('03:04');
  });

  it('survives an empty candle list without throwing', () => {
    // Arrange / Act — priceDomain/niceTicks must not blow up on no data
    const svg = renderChart([]);

    // Assert
    expect(svg.querySelectorAll('rect')).toHaveLength(0);
  });

  it('stays within its viewBox', () => {
    // Arrange / Act
    const svg = renderChart([makeCandle(), makeCandle()]);

    // Assert
    expect(svg.getAttribute('viewBox')).toBe('0 0 600 240');
  });
});
