import type { AppDispatch } from './store';
import {
  baseOf,
  pairFor,
  parseFrame,
  readSubscribeReply,
  readTickers,
  subscribeRequest,
} from '../lib/krakenProtocol';
import {
  socketStatusChanged,
  subscriptionsSettled,
  tickersApplied,
  KrakenTick,
  SocketStatus,
} from './pricesSlice';

// Overridable so the e2e build has no route to the exchange at all, rather than
// relying on every spec to remember to intercept.
const WS_URL =
  process.env.NEXT_PUBLIC_KRAKEN_WS_URL ?? 'wss://ws.kraken.com/v2';
const FLUSH_MS = 250;

// Kraken heartbeats about every second, so this much silence means the
// connection died without saying so. Frames, not ticks: a quiet market is fine.
const STALE_AFTER_MS = 10_000;

// How long Kraken gets to answer the subscribe. A reply that never comes is a
// symbol we are not subscribed to, and saying so beats waiting forever.
const HANDSHAKE_MS = 5000;

const MAX_BACKOFF_MS = 30_000;

// The watchdog only starts once a socket opens, so without this a transport that
// never leaves CONNECTING sits on the browser's own TCP timeout saying
// "connecting".
const CONNECT_TIMEOUT_MS = 10_000;

// Every timer belongs to the connection that armed it: sharing one handle lets a
// replacement overwrite it, leaving the old interval running with nothing to
// clear it by.
interface Connection {
  socket: WebSocket;
  generation: number;
  flushTimer: ReturnType<typeof setInterval> | null;
  staleTimer: ReturnType<typeof setTimeout> | null;
  handshakeTimer: ReturnType<typeof setTimeout> | null;
  connectTimer: ReturnType<typeof setTimeout> | null;
  // Both, before this connection may call itself live: an acknowledgement proves
  // Kraken took the subscription, never that it has sent anything for it.
  settled: boolean;
  seenTicker: boolean;
}

// Jittered, so a Kraken-side blip does not bring every client back in lockstep —
// the same argument lib/http.ts already makes for its retries.
const jittered = (ms: number) => ms / 2 + Math.random() * (ms / 2);

export function startKrakenTicker(
  symbols: string[],
  dispatch: AppDispatch,
): () => void {
  const pairs = symbols.map(pairFor);
  const subscribedPairs = new Set(pairs);
  const buffer = new Map<string, KrakenTick>(); // latest tick per symbol wins

  let current: Connection | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;
  let stopped = false;
  // Bumped per connection, so a frame from a socket we have already replaced can
  // be recognised and ignored rather than surfacing as fresh.
  let generation = 0;
  let status: SocketStatus = 'connecting';

  // Compared before dispatching: every frame proves the feed live, and saying so
  // per frame would put a dispatch on the path FLUSH_MS exists to keep clear.
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

  // A subscription Kraken accepted and never sends for would otherwise sit at
  // "Live" over a price from before the drop, forever.
  const promote = (conn: Connection) => {
    if (conn.settled && conn.seenTicker) setStatus('live');
  };

  const stopTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) clearTimeout(timer);
    return null;
  };

  // Unconditional: a connection's timers die with it whether or not its state
  // still matters to anyone.
  const release = (conn: Connection) => {
    if (conn.flushTimer) clearInterval(conn.flushTimer);
    conn.flushTimer = null;
    conn.staleTimer = stopTimer(conn.staleTimer);
    conn.handshakeTimer = stopTimer(conn.handshakeTimer);
    conn.connectTimer = stopTimer(conn.connectTimer);
  };

  // Armed on open, not on the first frame: waiting for a frame before watching
  // for missing frames never watches the socket that sends none.
  const armWatchdog = (conn: Connection) => {
    conn.staleTimer = stopTimer(conn.staleTimer);
    conn.staleTimer = setTimeout(() => {
      setStatus('stale');
      // Say it, then fix it. Closing routes this through the reconnect path
      // rather than leaving a half-open socket frozen and believed.
      conn.socket.close();
    }, STALE_AFTER_MS);
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      connect();
    }, jittered(backoff));
  };

  const connect = () => {
    // Handlers close over this context and its generation, not over `current`: a
    // late event from a replaced connection would otherwise act on the live one.
    const socket = new WebSocket(WS_URL);
    const conn: Connection = {
      socket,
      generation: ++generation,
      flushTimer: null,
      staleTimer: null,
      handshakeTimer: null,
      connectTimer: null,
      settled: false,
      seenTicker: false,
    };

    // Retired here rather than on its close event: nothing guarantees that event
    // lands before the replacement, and by then nothing points at its timers.
    const previous = current;
    current = conn;
    if (previous) {
      release(previous);
      previous.socket.close();
    }

    // Deliberately not set back to `connecting`: that status is the initial one
    // and means no feed has ever arrived, so the price on screen is the server's
    // own seed and current. A reconnect stays `offline` until a fresh ticker,
    // because by then the price is the dead socket's last, and saying
    // "connecting" over it would present it as current again.
    conn.connectTimer = setTimeout(() => socket.close(), CONNECT_TIMEOUT_MS);
    // The last connection's answer is not this one's, and a total refusal closes
    // without settling — so its verdict would otherwise outlive it.
    dispatch(subscriptionsSettled([]));

    // Kraken answers the subscribe once per symbol. Tracking which ones are
    // still outstanding is what stops the first "yes" speaking for all of them.
    const awaiting = new Set(pairs);
    const refused = new Set<string>();

    const settle = () => {
      if (awaiting.size > 0) return;
      conn.handshakeTimer = stopTimer(conn.handshakeTimer);

      if (refused.size === pairs.length) {
        // Subscribed to nothing. The transport is fine and useless; close it and
        // let the backoff decide when to try again — without resetting it.
        socket.close();
        return;
      }

      backoff = 1000; // at least one symbol is genuinely subscribed
      conn.settled = true;
      dispatch(subscriptionsSettled([...refused].map(baseOf)));
      promote(conn);
    };

    socket.onopen = () => {
      // Not live yet, and the backoff stays put: a server that accepts and drops
      // would otherwise reset it every cycle and spin at a reconnect a second.
      socket.send(subscribeRequest(pairs));
      conn.connectTimer = stopTimer(conn.connectTimer);
      conn.flushTimer = setInterval(flush, FLUSH_MS);
      armWatchdog(conn);

      conn.handshakeTimer = setTimeout(() => {
        if (awaiting.size === 0) return;
        // Silence is an answer: unreplied means unsubscribed, and the row should
        // say so rather than freeze without explanation.
        for (const pair of awaiting) refused.add(pair);
        awaiting.clear();
        settle();
      }, HANDSHAKE_MS);
    };

    socket.onmessage = (event) => {
      if (conn.generation !== generation) return;

      const frame = parseFrame((event as { data: string }).data);
      if (!frame) return;

      armWatchdog(conn);

      const reply = readSubscribeReply(frame);
      if (reply) {
        // A reply for a pair we are not waiting on answers for nobody; the
        // handshake deadline covers that rather than a guess.
        if (!awaiting.delete(reply.pair)) return;
        if (!reply.accepted) refused.add(reply.pair);
        settle();
        return;
      }

      // Only believable rows survive readTickers, so an empty or malformed frame
      // returns here: it proves the transport, the watchdog's job, but carries no
      // price and cannot earn "Live".
      const tickers = readTickers(frame, subscribedPairs);
      if (tickers.length === 0) return;

      conn.seenTicker = true;
      promote(conn); // also what un-stales a feed that went quiet
      for (const { pair, last } of tickers) {
        buffer.set(baseOf(pair), { symbol: baseOf(pair), last });
      }
    };

    socket.onclose = () => {
      release(conn);
      // The generation gates what this connection may still say, never whether
      // it cleans up.
      if (conn.generation !== generation) return;
      setStatus('offline');
      // Anything still buffered belongs to a dead connection; flushing it after
      // the reconnect would present a pre-drop price as a current one.
      buffer.clear();
      scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  };

  connect();

  return () => {
    stopped = true;
    reconnectTimer = stopTimer(reconnectTimer);
    buffer.clear();
    if (current) {
      release(current);
      current.socket.close();
    }
  };
}
