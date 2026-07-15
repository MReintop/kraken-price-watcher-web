import type { AppDispatch } from './store';
import {
  socketStatusChanged,
  subscriptionsSettled,
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
// the failure a price screen must never render as "Live". Note the watchdog
// tracks *frames*, not ticks: a quiet market is not a broken one.
const STALE_AFTER_MS = 10_000;

// How long Kraken gets to answer the subscribe. A reply that never comes is a
// symbol we are not subscribed to, and saying so beats waiting forever.
const HANDSHAKE_MS = 5000;

interface KrakenMessage {
  channel?: string;
  // A subscribe reply — one per symbol, and `result.symbol` says which. Reading
  // only `success` is how one accepted symbol comes to speak for eight.
  method?: string;
  success?: boolean;
  result?: { symbol?: string };
  // change_pct is deliberately not read: it is Kraken's own spot market, while
  // the 24h figure on screen is CoinGecko's cross-exchange one. Same window,
  // different venue — taking it would swap the source under the label.
  data?: { symbol: string; last: number }[];
}

// "BTC/USD" -> "BTC", the form the store is keyed by.
const baseOf = (pair: string) => pair.split('/')[0];

export function startKrakenTicker(
  symbols: string[],
  dispatch: AppDispatch,
): () => void {
  const pairs = symbols.map((s) => `${s.toUpperCase()}/USD`);
  const subscribedPairs = new Set(pairs);
  const buffer = new Map<string, KrakenTick>(); // latest tick per symbol wins

  let ws: WebSocket | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
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

  // Armed when the socket opens, not on the first frame: a connection that opens
  // and never says anything is the case worth catching, and waiting for a frame
  // to start watching for missing frames waits forever.
  const armWatchdog = (socket: WebSocket) => {
    staleTimer = stopTimer(staleTimer);
    staleTimer = setTimeout(() => {
      setStatus('stale');
      // Say it, then fix it. Closing routes this through the reconnect path
      // rather than leaving a half-open socket frozen and believed.
      socket.close();
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
    // Whatever Kraken refused last time was an answer about a connection that no
    // longer exists. This one has not answered yet, and a symbol carrying the
    // last connection's rejection would read as refused by this one — which,
    // when every symbol is refused and the socket closes without settling, is a
    // verdict that could outlive every connection that followed it.
    dispatch(subscriptionsSettled([]));

    // Kraken answers the subscribe once per symbol. Tracking which ones are
    // still outstanding is what stops the first "yes" speaking for all of them.
    const awaiting = new Set(pairs);
    const refused = new Set<string>();

    const settle = () => {
      if (awaiting.size > 0) return;
      handshakeTimer = stopTimer(handshakeTimer);

      if (refused.size === pairs.length) {
        // Subscribed to nothing. The transport is fine and useless; close it and
        // let the backoff decide when to try again — without resetting it.
        socket.close();
        return;
      }

      backoff = 1000; // at least one symbol is genuinely subscribed
      dispatch(subscriptionsSettled([...refused].map(baseOf)));
      setStatus('live');
    };

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
      armWatchdog(socket);

      handshakeTimer = setTimeout(() => {
        if (awaiting.size === 0) return;
        // Silence is an answer: a symbol Kraken never replied for is one we are
        // not receiving, and the row should say so rather than show a price that
        // stopped moving without explanation.
        for (const pair of awaiting) refused.add(pair);
        awaiting.clear();
        settle();
      }, HANDSHAKE_MS);
    };

    socket.onmessage = (event) => {
      if (mine !== generation) return;

      let msg: KrakenMessage;
      try {
        msg = JSON.parse((event as { data: string }).data);
      } catch {
        return;
      }

      armWatchdog(socket);

      if (msg.method === 'subscribe') {
        const pair = msg.result?.symbol;
        // Without a symbol there is no telling who was answered for; the
        // handshake deadline is what covers this rather than a guess.
        if (!pair || !awaiting.delete(pair)) return;
        if (!msg.success) refused.add(pair);
        settle();
        return;
      }

      if (msg.channel !== 'ticker' || !Array.isArray(msg.data)) return;
      setStatus('live'); // a frame after silence un-stales
      for (const t of msg.data) {
        // Checked, not trusted: the frame is JSON off a socket. A price that is
        // not a finite number reaches SVG geometry and draws nothing at all, and
        // a symbol we never subscribed to has no row to reach — it would just
        // accumulate in the store under a key nobody reads.
        if (!subscribedPairs.has(t?.symbol) || !Number.isFinite(t?.last)) {
          continue;
        }
        const base = baseOf(t.symbol);
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
      handshakeTimer = stopTimer(handshakeTimer);
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
    handshakeTimer = stopTimer(handshakeTimer);
    ws?.close();
  };
}
