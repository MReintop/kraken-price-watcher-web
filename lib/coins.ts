import { fetchWithRetry } from './http';
import {
  fetchKrakenPrices,
  fetchKrakenCandles,
  fetchKrakenPairDecimals,
} from './kraken';
import type { Candle } from './candleChart';

export type Coin = {
  id: string;
  name: string;
  // From TRACKED_MARKETS, not from CoinGecko: it is the store's key.
  symbol: string;
  image: string;
  current_price: number;
  // Kraken's precision for this market — a fact about the pair, not the number.
  price_decimals: number;
  // Nullable because CoinGecko reports null on markets too thin to measure; a row
  // inventing 0.00% would read as a market that did not move.
  price_change_percentage_24h: number | null;
  market_cap: number;
  total_volume: number;
};

// Overridable so tests can serve a stub upstream.
const COINGECKO_BASE =
  process.env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3';

// What we track, and every name each upstream knows it by. This is the
// authority: CoinGecko says what a coin *is*, but its symbol is display
// metadata, never a protocol identifier. Deriving the socket's pair from it
// unsubscribes dogecoin the day CoinGecko renames a ticker — and Kraken calls
// that market XDG, which CoinGecko has never called it.
export interface TrackedMarket {
  id: string; // CoinGecko's id, and how a detail route names a coin
  symbol: string; // display, and the key the price store is keyed by
  restPair: string; // Kraken REST: Ticker, OHLC and AssetPairs are keyed by it
  websocketPair: string; // Kraken WebSocket v2, which names markets differently
}

export const TRACKED_MARKETS: readonly TrackedMarket[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    restPair: 'XXBTZUSD',
    websocketPair: 'BTC/USD',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    restPair: 'XETHZUSD',
    websocketPair: 'ETH/USD',
  },
  { id: 'solana', symbol: 'SOL', restPair: 'SOLUSD', websocketPair: 'SOL/USD' },
  {
    id: 'cardano',
    symbol: 'ADA',
    restPair: 'ADAUSD',
    websocketPair: 'ADA/USD',
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    restPair: 'XXRPZUSD',
    websocketPair: 'XRP/USD',
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    restPair: 'XDGUSD',
    websocketPair: 'XDG/USD',
  },
  {
    id: 'polkadot',
    symbol: 'DOT',
    restPair: 'DOTUSD',
    websocketPair: 'DOT/USD',
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    restPair: 'LINKUSD',
    websocketPair: 'LINK/USD',
  },
];

export const marketFor = (id: string): TrackedMarket | undefined =>
  TRACKED_MARKETS.find((market) => market.id === id);

const pairFor = (id: string) => marketFor(id)?.restPair;

type CoinMetadata = Pick<
  Coin,
  | 'id'
  | 'name'
  | 'symbol'
  | 'image'
  | 'market_cap'
  | 'total_volume'
  | 'price_change_percentage_24h'
>;

const METADATA_URL = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${TRACKED_MARKETS.map(
  (market) => market.id,
).join(',')}&price_change_percentage=24h`;

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// The body is cast, not validated; the change is genuinely null on thin markets.
function toCoinMetadata(raw: unknown): CoinMetadata | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const coin = raw as Record<string, unknown>;

  if (!isText(coin.id) || !isText(coin.name) || !isText(coin.symbol)) {
    return null;
  }
  if (!isText(coin.image)) return null;
  if (!isNumber(coin.market_cap) || !isNumber(coin.total_volume)) return null;

  return {
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    image: coin.image,
    market_cap: coin.market_cap,
    total_volume: coin.total_volume,
    price_change_percentage_24h: isNumber(coin.price_change_percentage_24h)
      ? coin.price_change_percentage_24h
      : null,
  };
}

async function fetchCoinMetadata(): Promise<CoinMetadata[]> {
  const response = await fetchWithRetry(METADATA_URL, {
    next: { revalidate: 60 },
  } as RequestInit);
  if (!response.ok) {
    throw new Error(`CoinGecko markets: HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new Error('CoinGecko markets: expected an array');
  }
  return body
    .map(toCoinMetadata)
    .filter((coin): coin is CoinMetadata => coin !== null);
}

// Price from Kraken (as the socket and candles use); the 24h change stays
// CoinGecko's — same window, different market.
export async function getCoins(): Promise<Coin[]> {
  const pairs = TRACKED_MARKETS.map((market) => market.restPair);
  const [metadata, prices, decimals] = await Promise.all([
    fetchCoinMetadata(),
    fetchKrakenPrices(pairs),
    fetchKrakenPairDecimals(pairs),
  ]);

  return TRACKED_MARKETS.flatMap(({ id, symbol, restPair }) => {
    const coin = metadata.find((entry) => entry.id === id);
    const last = prices.get(restPair);
    const places = decimals.get(restPair);
    // No precision to render it at, so dropped like a missing price, not guessed.
    if (!coin || last == null || places == null) return [];
    // Our symbol, not CoinGecko's: this one keys the price store, and the socket
    // resolves the same one from the pair it subscribed to.
    return [{ ...coin, symbol, current_price: last, price_decimals: places }];
  });
}

export async function getCoin(id: string): Promise<Coin | undefined> {
  const coins = await getCoins();
  return coins.find((coin) => coin.id === id);
}

// Lets a caller separate "we do not track that" from "the exchange failed us",
// which are the same exception but a very different answer.
export const isTrackedCoin = (id: string) => pairFor(id) !== undefined;

export async function getCoinCandles(
  id: string,
  days: number | string = 30,
): Promise<Candle[]> {
  const pair = pairFor(id);
  if (!pair) throw new Error(`No Kraken pair is mapped for "${id}"`);
  return fetchKrakenCandles(pair, Number(days));
}
