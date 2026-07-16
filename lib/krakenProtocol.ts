// Kraken's WebSocket v2 wire format, and nothing about what we do with it.
// Frames arrive as JSON off a socket, so every field here is a claim until read.

export interface KrakenTicker {
  pair: string; // as Kraken names it, e.g. "BTC/USD"
  last: number;
}

export interface SubscribeReply {
  pair: string;
  accepted: boolean;
}

// "BTC/USD" -> "BTC", the form the store is keyed by.
export const baseOf = (pair: string) => pair.split('/')[0];

export const pairFor = (symbol: string) => `${symbol.toUpperCase()}/USD`;

export const subscribeRequest = (pairs: string[]) =>
  JSON.stringify({
    method: 'subscribe',
    params: { channel: 'ticker', symbol: pairs },
  });

// `data` carries more than `last` on the wire — change_pct among it — but only
// `last` is read: change_pct is Kraken's own venue, while the 24h figure on
// screen is CoinGecko's cross-exchange one, and mixing them swaps the source
// under the label.
interface KrakenFrame {
  channel?: string;
  method?: string;
  success?: boolean;
  result?: { symbol?: string };
  data?: { symbol?: unknown; last?: unknown }[];
}

export function parseFrame(raw: string): KrakenFrame | null {
  try {
    const frame: unknown = JSON.parse(raw);
    return typeof frame === 'object' && frame !== null
      ? (frame as KrakenFrame)
      : null;
  } catch {
    return null;
  }
}

// Kraken answers a subscribe once per symbol, and `result.symbol` says which.
// Reading only `success` is how one accepted symbol comes to speak for eight.
// An unnamed reply answers for nobody, so it is not an answer.
export function readSubscribeReply(frame: KrakenFrame): SubscribeReply | null {
  if (frame.method !== 'subscribe') return null;
  const pair = frame.result?.symbol;
  return pair ? { pair, accepted: frame.success === true } : null;
}

// Returns [] for a frame that is not a ticker, and drops rows that cannot be
// believed: a price that is not a finite number reaches chart geometry and draws
// nothing at all, and a pair we never asked for has no row to land in.
export function readTickers(
  frame: KrakenFrame,
  subscribed: ReadonlySet<string>,
): KrakenTicker[] {
  if (frame.channel !== 'ticker' || !Array.isArray(frame.data)) return [];

  const tickers: KrakenTicker[] = [];
  for (const row of frame.data) {
    const pair = row?.symbol;
    const last = row?.last;
    if (typeof pair !== 'string' || !subscribed.has(pair)) continue;
    if (typeof last !== 'number' || !Number.isFinite(last)) continue;
    tickers.push({ pair, last });
  }
  return tickers;
}
