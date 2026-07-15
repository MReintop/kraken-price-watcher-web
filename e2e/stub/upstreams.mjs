// Stands in for both upstreams: CoinGecko under /coingecko and Kraken under
// /kraken. Every response derives from fixed seeds — no clock, no randomness,
// identical bytes on every run.
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 4001);

const COINS = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'btc',
    pair: 'XXBTZUSD',
    price: 62888,
    open24h: 63814.2,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'eth',
    pair: 'XETHZUSD',
    price: 1883.21,
    open24h: 1837.28,
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'sol',
    pair: 'SOLUSD',
    price: 142.5,
    open24h: 135.59,
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ada',
    pair: 'ADAUSD',
    price: 0.38,
    open24h: 0.382871,
  },
  {
    id: 'ripple',
    name: 'XRP',
    symbol: 'xrp',
    pair: 'XXRPZUSD',
    price: 0.52,
    open24h: 0.513834,
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    symbol: 'doge',
    pair: 'XDGUSD',
    price: 0.12,
    open24h: 0.124224,
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'dot',
    pair: 'DOTUSD',
    price: 4.15,
    open24h: 4.11298,
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    symbol: 'link',
    pair: 'LINKUSD',
    price: 11.3,
    open24h: 10.8446,
  },
];

const round = (n) => Math.round(n * 100) / 100;

// CoinGecko: identity only. Prices here are deliberately absent — the app takes
// them from Kraken.
const markets = () =>
  COINS.map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    image: `http://localhost:${PORT}/icon/${coin.id}.png`,
    market_cap: 1_000_000,
    total_volume: 500_000,
  }));

// Kraken /Ticker: `c` is [last, lotVolume], `o` is the 24h open. Prices are
// strings, as the real API sends them.
const ticker = (requested) => {
  const wanted = new Set(requested.split(','));
  return Object.fromEntries(
    COINS.filter((coin) => wanted.has(coin.pair)).map((coin) => [
      coin.pair,
      { c: [String(coin.price), '1.0'], o: String(coin.open24h) },
    ]),
  );
};

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
