import { getCoin, getCoins, getCoinCandles } from './coins';
import {
  fetchKrakenPrices,
  fetchKrakenCandles,
  fetchKrakenPairDecimals,
} from './kraken';

// Kraken has its own suite; stubbed here so these tests are about how the two
// sources are merged.
jest.mock('./kraken', () => ({
  fetchKrakenPrices: jest.fn(),
  fetchKrakenCandles: jest.fn(),
  fetchKrakenPairDecimals: jest.fn(),
}));

const mockPrices = fetchKrakenPrices as jest.Mock;
const mockCandles = fetchKrakenCandles as jest.Mock;
const mockDecimals = fetchKrakenPairDecimals as jest.Mock;

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

// Kraken quotes BTC/USD to a tenth of a dollar and ETH/USD to a cent.
const precision = () =>
  new Map([
    ['XXBTZUSD', 1],
    ['XETHZUSD', 2],
  ]);

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => metadata(),
  }) as unknown as typeof fetch;
  mockPrices.mockResolvedValue(priced());
  mockDecimals.mockResolvedValue(precision());
});

afterEach(() => jest.resetAllMocks());

// Arrange helper: serve whatever CoinGecko is pretending to send this time.
const coinGeckoReturns = (body: unknown) => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => body,
  });
};

// TypeScript describes what CoinGecko documents. Only these check what it sent.
describe('getCoins — upstream that does not keep its contract', () => {
  it('keeps a coin whose 24h change is missing, rather than losing its price', () => {
    // Arrange — CoinGecko sends null on markets too thin to measure
    coinGeckoReturns([
      { ...metadata()[0], price_change_percentage_24h: null },
      metadata()[1],
    ]);

    // Act
    return getCoins().then((coins) => {
      // Assert — the price is the point; the percentage is not worth it
      expect(coins[0]).toMatchObject({
        id: 'bitcoin',
        current_price: 64788,
        price_change_percentage_24h: null,
      });
    });
  });

  it('drops a coin whose numbers are not numbers', async () => {
    // Arrange
    coinGeckoReturns([{ ...metadata()[0], market_cap: 'lots' }, metadata()[1]]);

    // Act
    const coins = await getCoins();

    // Assert — NaN here reaches the chart's geometry and draws nothing at all
    expect(coins.map((coin) => coin.id)).toEqual(['ethereum']);
  });

  it('drops a coin missing the fields it is identified by', async () => {
    // Arrange
    coinGeckoReturns([{ ...metadata()[0], name: undefined }, metadata()[1]]);

    // Act
    const coins = await getCoins();

    // Assert — a card headed "undefined" is worse than one fewer card
    expect(coins.map((coin) => coin.id)).toEqual(['ethereum']);
  });

  it('refuses a response that is not a list at all', async () => {
    // Arrange — an error object where the array should be
    coinGeckoReturns({ error: 'rate limited' });

    // Act / Assert
    await expect(getCoins()).rejects.toThrow('expected an array');
  });
});

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

  // Kraken's REST offers only `o`, today's open — a change from it measures
  // however long today has been, and near midnight gets the sign wrong.
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

  it('takes the price precision from Kraken, per pair', async () => {
    // Arrange / Act — BTC/USD trades to a tenth of a dollar, ETH/USD to a cent
    const coins = await getCoins();

    // Assert — a fact about the market, carried beside the price
    expect(coins.map((coin) => coin.price_decimals)).toEqual([1, 2]);
  });

  it('drops a coin Kraken quotes no precision for, rather than guessing one', async () => {
    // Arrange — only bitcoin has reference data
    mockDecimals.mockResolvedValue(new Map([['XXBTZUSD', 1]]));

    // Act
    const coins = await getCoins();

    // Assert — a price with no precision cannot be rendered honestly
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
