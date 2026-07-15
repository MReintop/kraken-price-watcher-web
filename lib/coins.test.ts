import { getCoin, getCoins, getCoinCandles } from './coins';
import { fetchKrakenPrices, fetchKrakenCandles } from './kraken';

// Kraken has its own suite; stubbed here so these tests are about how the two
// sources are merged.
jest.mock('./kraken', () => ({
  fetchKrakenPrices: jest.fn(),
  fetchKrakenCandles: jest.fn(),
}));

const mockPrices = fetchKrakenPrices as jest.Mock;
const mockCandles = fetchKrakenCandles as jest.Mock;

const metadata = () => [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'btc',
    image: 'x',
    market_cap: 1,
    total_volume: 2,
    price_change_percentage_24h: -1.45,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'eth',
    image: 'y',
    market_cap: 3,
    total_volume: 4,
    price_change_percentage_24h: 2.5,
  },
];

const priced = () =>
  new Map([
    ['XXBTZUSD', 64788],
    ['XETHZUSD', 1881],
  ]);

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => metadata(),
  }) as unknown as typeof fetch;
  mockPrices.mockResolvedValue(priced());
});

afterEach(() => jest.resetAllMocks());

describe('getCoins', () => {
  it('takes identity from CoinGecko', async () => {
    // Arrange / Act
    const coins = await getCoins();

    // Assert
    expect(coins[0]).toMatchObject({
      id: 'bitcoin',
      name: 'Bitcoin',
      image: 'x',
    });
  });

  it('takes the price from Kraken, not CoinGecko', async () => {
    // Arrange / Act
    const coins = await getCoins();

    // Assert — the same source the socket and the candles use
    expect(coins[0].current_price).toBe(64788);
  });

  // The window has to match the socket's change_pct, which is a rolling 24h.
  // Kraken's REST ticker only offers `o`, today's open, so a change derived from
  // it would measure however long today has been and be silently corrected by
  // the first tick — wrong magnitude, and around midnight the wrong sign.
  it('takes the 24h change from CoinGecko, the only rolling-24h source', async () => {
    // Arrange / Act
    const coins = await getCoins();

    // Assert
    expect(coins[0].price_change_percentage_24h).toBe(-1.45);
    expect(coins[1].price_change_percentage_24h).toBe(2.5);
  });

  it('asks CoinGecko for identity and Kraken for prices', async () => {
    // Arrange / Act
    await getCoins();

    // Assert
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(
      '/coins/markets',
    );
    expect(mockPrices).toHaveBeenCalledWith(
      expect.arrayContaining(['XXBTZUSD', 'SOLUSD']),
    );
  });

  it('drops a coin Kraken has no price for, rather than showing it at zero', async () => {
    // Arrange — only bitcoin is priced
    mockPrices.mockResolvedValue(new Map([['XXBTZUSD', 64788]]));

    // Act
    const coins = await getCoins();

    // Assert
    expect(coins.map((coin) => coin.id)).toEqual(['bitcoin']);
  });

  it('drops a coin CoinGecko has no metadata for', async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [metadata()[0]],
    });

    // Act
    const coins = await getCoins();

    // Assert
    expect(coins.map((coin) => coin.id)).toEqual(['bitcoin']);
  });

  it('throws when CoinGecko rejects the request', async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    // Act / Assert
    await expect(getCoins()).rejects.toThrow('HTTP 429');
  });
});

describe('getCoin', () => {
  it('returns the coin whose id matches', async () => {
    // Arrange / Act
    const coin = await getCoin('ethereum');

    // Assert
    expect(coin?.name).toBe('Ethereum');
  });

  it('returns undefined for an id that is not tracked', async () => {
    // Arrange / Act
    const coin = await getCoin('nosuchcoin');

    // Assert
    expect(coin).toBeUndefined();
  });
});

describe('getCoinCandles', () => {
  it('maps a CoinGecko id to its Kraken pair', async () => {
    // Arrange
    mockCandles.mockResolvedValue([]);

    // Act
    await getCoinCandles('bitcoin', 30);

    // Assert — Kraken calls it XXBTZUSD, not "bitcoin"
    expect(mockCandles).toHaveBeenCalledWith('XXBTZUSD', 30);
  });

  it('accepts the days value as the string a query param gives it', async () => {
    // Arrange
    mockCandles.mockResolvedValue([]);

    // Act
    await getCoinCandles('solana', '365');

    // Assert
    expect(mockCandles).toHaveBeenCalledWith('SOLUSD', 365);
  });

  it('defaults to the 30-day timeframe', async () => {
    // Arrange
    mockCandles.mockResolvedValue([]);

    // Act
    await getCoinCandles('cardano');

    // Assert
    expect(mockCandles).toHaveBeenCalledWith('ADAUSD', 30);
  });

  it('returns the candles Kraken supplies', async () => {
    // Arrange
    const candles = [{ t: 1, o: 2, h: 3, l: 4, c: 5 }];
    mockCandles.mockResolvedValue(candles);

    // Act
    const result = await getCoinCandles('bitcoin');

    // Assert
    expect(result).toBe(candles);
  });

  it('throws for a coin with no Kraken pair, instead of an empty chart', async () => {
    // Arrange / Act / Assert
    await expect(getCoinCandles('nosuchcoin')).rejects.toThrow(
      'No Kraken pair is mapped',
    );
  });
});
