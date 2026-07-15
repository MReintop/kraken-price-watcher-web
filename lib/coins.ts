import { fetchWithRetry } from './http';
import { fetchKrakenPrices, fetchKrakenCandles } from './kraken';
import type { Candle } from './candleChart';

export type Coin = {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
};

// Overridable so tests can serve a stub upstream.
const COINGECKO_BASE =
  process.env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3';

// CoinGecko says what a coin *is*; Kraken says what it is *worth*. The pair is
// Kraken's own canonical name, which is what its responses are keyed by.
// Using kraken because of CoinGecko rate limit
const TRACKED_COINS = [
  { id: 'bitcoin', pair: 'XXBTZUSD' },
  { id: 'ethereum', pair: 'XETHZUSD' },
  { id: 'solana', pair: 'SOLUSD' },
  { id: 'cardano', pair: 'ADAUSD' },
  { id: 'ripple', pair: 'XXRPZUSD' },
  { id: 'dogecoin', pair: 'XDGUSD' },
  { id: 'polkadot', pair: 'DOTUSD' },
  { id: 'chainlink', pair: 'LINKUSD' },
] as const;

const pairFor = (id: string) =>
  TRACKED_COINS.find((coin) => coin.id === id)?.pair;

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

const METADATA_URL = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${TRACKED_COINS.map(
  (coin) => coin.id,
).join(',')}&price_change_percentage=24h`;

async function fetchCoinMetadata(): Promise<CoinMetadata[]> {
  const response = await fetchWithRetry(METADATA_URL, {
    next: { revalidate: 60 },
  } as RequestInit);
  if (!response.ok) {
    throw new Error(`CoinGecko markets: HTTP ${response.status}`);
  }
  return response.json();
}

// Price from Kraken — the same source the live socket and the candles use, so
// every price in the app comes from one place. The 24h change stays CoinGecko's:
// it is the only upstream here that measures a rolling 24 hours, which is the
// window the socket's change_pct uses once it takes over.
export async function getCoins(): Promise<Coin[]> {
  const [metadata, prices] = await Promise.all([
    fetchCoinMetadata(),
    fetchKrakenPrices(TRACKED_COINS.map((coin) => coin.pair)),
  ]);

  return TRACKED_COINS.flatMap(({ id, pair }) => {
    const coin = metadata.find((entry) => entry.id === id);
    const last = prices.get(pair);
    if (!coin || last == null) return [];
    return [{ ...coin, current_price: last }];
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
