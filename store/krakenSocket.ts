import type { AppDispatch } from './store';
import {
  socketStatusChanged,
  tickersApplied,
  KrakenTick,
  SocketStatus,
} from './pricesSlice';

// One connection for every symbol, coalescing ticks into at most one dispatch
// per FLUSH_MS.
//
// Overridable so the e2e build cannot reach the exchange: NEXT_PUBLIC_ is
// inlined at build time, so a suite built with it set has no route to Kraken at
// all, rather than relying on every spec remembering to intercept.
const WS_URL =
  process.env.NEXT_PUBLIC_KRAKEN_WS_URL ?? 'wss://ws.kraken.com/v2';
const FLUSH_MS = 250;

// Kraken heartbeats about every second when nothing else is flowing, so silence
// this long means the connection is dead in a way it has not told us about —
// the failure a price screen must never render as "Live".
const STALE_AFTER_MS = 10_000;

interface KrakenMessage {
  channel?: string;
  // A subscribe reply, one per symbol, carrying success or an error string.
  method?: string;
  success?: boolean;
  // change_pct is deliberately not read: it is Kraken's own spot market, while
  // the 24h figure on screen is CoinGecko's cross-exchange one. Same window,
  // different venue — taking it would swap the source under the label.
  data?: { symbol: string; last: number }[];
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
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;
  let stopped = false;
  // Bumped per connection, so a frame from a socket we have already replaced can
  // be recognised and ignored rather than surfacing as fresh.
  let generation = 0;
  let status: SocketStatus = 'connecting';

  // Held locally and compared before dispatching: every frame proves the feed is
  // live, and re-announcing that per frame would put a dispatch on the hot path
  // the flush window exists to keep off it.
  const setStatus = (next: SocketStatus) => {
    if (status === next) return;
    status = next;
    dispatch(socketStatusChanged(next));
  };

  const flush = () => {
    if (buffer.size === 0) return;
    dispatch(tickersApplied(Array.from(buffer.values())));
    buffer.clear();
  };

  const stopTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) clearTimeout(timer);
    return null;
  };

  // Any frame proves the connection is alive — a heartbeat as much as a tick.
  const markFresh = () => {
    staleTimer = stopTimer(staleTimer);
    staleTimer = setTimeout(() => {
      setStatus('stale');
    }, STALE_AFTER_MS);
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, 30_000);
      connect();
    }, backoff);
  };

  const connect = () => {
    // Handlers close over this socket and its generation, not over `ws`: a late
    // event from a replaced connection would otherwise act on the live one.
    const socket = new WebSocket(WS_URL);
    const mine = ++generation;
    ws = socket;
    setStatus('connecting');

    socket.onopen = () => {
      // Deliberately not live yet, and the backoff stays where it is: an open
      // transport says nothing about whether Kraken accepted the subscription.
      // A server that accepts and immediately closes would otherwise reset the
      // backoff every cycle and spin at one reconnect a second.
      socket.send(
        JSON.stringify({
          method: 'subscribe',
          params: { channel: 'ticker', symbol: pairs },
        }),
      );
      flushTimer = setInterval(flush, FLUSH_MS);
    };

    socket.onmessage = (event) => {
      if (mine !== generation) return;

      let msg: KrakenMessage;
      try {
        msg = JSON.parse((event as { data: string }).data);
      } catch {
        return;
      }

      markFresh();

      if (msg.method === 'subscribe') {
        if (!msg.success) return; // a rejected symbol must not read as live
        backoff = 1000; // an acknowledged connection is the only healthy one
        setStatus('live');
        return;
      }

      if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) return;
      setStatus('live'); // a frame after silence un-stales
      for (const t of msg.data) {
        const base = t.symbol.split('/')[0]; // "BTC/USD" -> "BTC"
        buffer.set(base, { symbol: base, last: t.last });
      }
    };

    socket.onclose = () => {
      if (mine !== generation) return;
      setStatus('offline');
      // Anything still buffered belongs to a dead connection; flushing it after
      // the reconnect would present a pre-drop price as a current one.
      buffer.clear();
      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
      staleTimer = stopTimer(staleTimer);
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
    staleTimer = stopTimer(staleTimer);
    ws?.close();
  };
}
