// Stands in for both upstreams: CoinGecko under /coingecko and Kraken under
// /kraken. Every response derives from fixed seeds — no clock, no randomness,
// identical bytes on every run.
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 4001);

// `price` is Kraken's; `change24h` is CoinGecko's rolling-24h figure, which is
// the only 24h window either upstream actually reports.
const COINS = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'btc',
    pair: 'XXBTZUSD',
    price: 62888,
    change24h: -1.45,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'eth',
    pair: 'XETHZUSD',
    price: 1883.21,
    change24h: 2.5,
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'sol',
    pair: 'SOLUSD',
    price: 142.5,
    change24h: 5.1,
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ada',
    pair: 'ADAUSD',
    price: 0.38,
    change24h: -0.75,
  },
  {
    id: 'ripple',
    name: 'XRP',
    symbol: 'xrp',
    pair: 'XXRPZUSD',
    price: 0.52,
    change24h: 1.2,
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    symbol: 'doge',
    pair: 'XDGUSD',
    price: 0.12,
    change24h: -3.4,
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'dot',
    pair: 'DOTUSD',
    price: 4.15,
    change24h: 0.9,
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    symbol: 'link',
    pair: 'LINKUSD',
    price: 11.3,
    change24h: 4.2,
  },
];

const round = (n) => Math.round(n * 100) / 100;

// CoinGecko: identity and the 24h change. The price is deliberately absent —
// the app takes that from Kraken.
const markets = () =>
  COINS.map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    image: `http://localhost:${PORT}/icon/${coin.id}.png`,
    market_cap: 1_000_000,
    total_volume: 500_000,
    price_change_percentage_24h: coin.change24h,
  }));

// `o` is *today's* open, served because the real API serves it and set to
// disagree with change24h on purpose: derive a 24h change from it and every coin
// lands in a narrow green band, which is what that bug looks like in the wild.
const ticker = (requested) => {
  const wanted = new Set(requested.split(','));
  return Object.fromEntries(
    COINS.filter((coin) => wanted.has(coin.pair)).map((coin) => [
      coin.pair,
      { c: [String(coin.price), '1.0'], o: String(coin.price * 0.99) },
    ]),
  );
};

// The upstream-failure fixture. Nothing else asks for polkadot at 24H, so this
// one pair and interval can fail every time without a mutable flag that the
// parallel specs would race each other over.
const FAILING_OHLC = { pair: 'DOTUSD', interval: 60 };

// Kraken /OHLC: [timeSeconds, open, high, low, close, vwap, volume, count].
// A sine walk around the coin's price, anchored to a fixed epoch so the x-axis
// labels never move.
const EPOCH_SECONDS = Date.UTC(2026, 0, 1) / 1000;

const ohlc = (pair, interval) => {
  const coin = COINS.find((entry) => entry.pair === pair);
  if (!coin) return null;
  const count = 60;
  const stepSeconds = interval * 60;
  const base = coin.price;

  const rows = Array.from({ length: count }, (_, i) => {
    const open = base + Math.sin(i / 3) * base * 0.02;
    const close = base + Math.sin((i + 1) / 3) * base * 0.02;
    return [
      EPOCH_SECONDS + i * stepSeconds,
      String(round(open)),
      String(round(Math.max(open, close) + base * 0.005)),
      String(round(Math.min(open, close) - base * 0.005)),
      String(round(close)),
      String(round(open)),
      '1.0',
      10,
    ];
  });

  return { [pair]: rows, last: EPOCH_SECONDS };
};

export function createStubServer() {
  return createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const json = (body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    // Kraken reports failure as HTTP 200 with a populated error array.
    const krakenError = (message) => json({ error: [message], result: {} });

    if (url.pathname === '/coingecko/coins/markets') return json(markets());

    if (url.pathname === '/kraken/Ticker') {
      const pair = url.searchParams.get('pair');
      if (!pair) return krakenError('EGeneral:Invalid arguments');
      return json({ error: [], result: ticker(pair) });
    }

    if (url.pathname === '/kraken/OHLC') {
      const pair = url.searchParams.get('pair');
      const interval = Number(url.searchParams.get('interval') ?? 1440);
      if (pair === FAILING_OHLC.pair && interval === FAILING_OHLC.interval) {
        return krakenError('EService:Unavailable');
      }
      const result = ohlc(pair, interval);
      if (!result) return krakenError('EQuery:Unknown asset pair');
      return json({ error: [], result });
    }

    // 1x1 transparent gif, so coin icons resolve without hitting the network.
    // Timing-Allow-Origin, or the browser reports transferSize 0 for these and
    // the byte budgets in performance.spec.ts silently stop seeing them.
    if (url.pathname.startsWith('/icon/')) {
      res.writeHead(200, {
        'content-type': 'image/gif',
        'timing-allow-origin': '*',
      });
      return res.end(
        Buffer.from(
          'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          'base64',
        ),
      );
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found', path: url.pathname }));
  });
}

createStubServer().listen(PORT, () => {
  console.log(`[stub] upstreams listening on http://localhost:${PORT}`);
});
