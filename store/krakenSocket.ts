import type { AppDispatch } from './store';
import { socketStatusChanged, tickersApplied, KrakenTick } from './pricesSlice';

// One connection for every symbol, coalescing ticks into at most one dispatch
// per FLUSH_MS.
//
// Overridable so the e2e build cannot reach the exchange: NEXT_PUBLIC_ is
// inlined at build time, so a suite built with it set has no route to Kraken at
// all, rather than relying on every spec remembering to intercept.
const WS_URL =
  process.env.NEXT_PUBLIC_KRAKEN_WS_URL ?? 'wss://ws.kraken.com/v2';
const FLUSH_MS = 250;

interface KrakenTickerMessage {
  channel?: string;
  data?: { symbol: string; last: number; change_pct: number }[];
}

export function startKrakenTicker(
  symbols: string[],
  dispatch: AppDispatch,
): () => void {
  const pairs = symbols.map((s) => `${s.toUpperCase()}/USD`);
  const buffer = new Map<string, KrakenTick>(); // latest tick per symbol wins

  let ws: WebSocket | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;
  let stopped = false;

  const flush = () => {
    if (buffer.size === 0) return;
    dispatch(tickersApplied(Array.from(buffer.values())));
    buffer.clear();
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, 30_000);
      connect();
    }, backoff);
  };

  const connect = () => {
    // Handlers close over this socket, not over `ws`: a late event from a
    // replaced connection would otherwise act on the live one.
    const socket = new WebSocket(WS_URL);
    ws = socket;

    socket.onopen = () => {
      backoff = 1000; // reset backoff on a healthy connection
      dispatch(socketStatusChanged(true));
      socket.send(
        JSON.stringify({
          method: 'subscribe',
          params: { channel: 'ticker', symbol: pairs },
        }),
      );
      flushTimer = setInterval(flush, FLUSH_MS);
    };

    socket.onmessage = (event) => {
      let msg: KrakenTickerMessage;
      try {
        msg = JSON.parse((event as { data: string }).data);
      } catch {
        return;
      }
      if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) return;
      for (const t of msg.data) {
        const base = t.symbol.split('/')[0]; // "BTC/USD" -> "BTC"
        buffer.set(base, {
          symbol: base,
          last: t.last,
          changePct: t.change_pct,
        });
      }
    };

    socket.onclose = () => {
      dispatch(socketStatusChanged(false));
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  connect();

  return () => {
    stopped = true;
    if (flushTimer) clearInterval(flushTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
