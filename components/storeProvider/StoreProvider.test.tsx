import { render, screen } from '@testing-library/react';
import type { Coin } from '@/lib/coins';
import CoinPriceRow from '@/components/coinPriceRow/CoinPriceRow';
import StoreProvider from './StoreProvider';

// Stubbed: the seeding is under test here, not the socket it opens on mount.
jest.mock('@/store/krakenSocket', () => ({
  startKrakenTicker: jest.fn(() => jest.fn()),
}));

const makeCoin = (overrides: Partial<Coin> = {}): Coin => ({
  id: 'bitcoin',
  name: 'Bitcoin',
  symbol: 'btc',
  image: '',
  current_price: 62888,
  price_change_percentage_24h: -1.45,
  market_cap: 0,
  total_volume: 0,
  ...overrides,
});

describe('StoreProvider', () => {
  it('seeds the store from server coins, so the first paint already has prices', () => {
    // Arrange
    const coins = [makeCoin({ current_price: 62888 })];

    // Act
    render(
      <StoreProvider initialCoins={coins}>
        <CoinPriceRow symbol="btc" />
      </StoreProvider>,
    );

    // Assert — no spinner, no client round-trip: the value is there on render 1
    expect(screen.getByText('$62,888.00')).toBeInTheDocument();
  });

  it("upper-cases seeded symbols to match the socket's, so a lower-case id still resolves", () => {
    // Arrange — the API returns 'btc'; the socket dispatches 'BTC'
    const coins = [makeCoin({ symbol: 'btc' })];

    // Act
    render(
      <StoreProvider initialCoins={coins}>
        <CoinPriceRow symbol="BTC" />
      </StoreProvider>,
    );

    // Assert — a casing mismatch here would silently render nothing
    expect(screen.getByText('$62,888.00')).toBeInTheDocument();
  });

  it('seeds every coin it is given', () => {
    // Arrange
    const coins = [
      makeCoin({ symbol: 'btc', current_price: 62888 }),
      makeCoin({ id: 'ethereum', symbol: 'eth', current_price: 1883.21 }),
    ];

    // Act
    render(
      <StoreProvider initialCoins={coins}>
        <CoinPriceRow symbol="eth" />
      </StoreProvider>,
    );

    // Assert
    expect(screen.getByText('$1,883.21')).toBeInTheDocument();
  });

  it('renders children with no prices when given no coins', () => {
    // Arrange / Act
    const { container } = render(
      <StoreProvider initialCoins={[]}>
        <CoinPriceRow symbol="btc" />
      </StoreProvider>,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });
});
