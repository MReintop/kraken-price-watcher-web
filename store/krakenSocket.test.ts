import { startKrakenTicker } from './krakenSocket';
import { tickersApplied, socketStatusChanged } from './pricesSlice';
import type { AppDispatch } from './store';

// A stand-in for the browser WebSocket: records what was sent, and lets a test
// drive onopen/onmessage/onclose by hand.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
}

const latest = () =>
  FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

const tickerMessage = (data: unknown) => ({
  data: JSON.stringify({ channel: 'ticker', data }),
});

// Kraken replies to a subscribe with one of these per symbol.
const subscribeReply = (success = true) => ({
  data: JSON.stringify({
    method: 'subscribe',
    success,
    result: { channel: 'ticker', symbol: 'BTC/USD' },
  }),
});

let dispatch: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  FakeWebSocket.instances = [];
  dispatch = jest.fn();
  global.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  jest.useRealTimers();
});

// Arrange helper: start the ticker, open its socket, and let Kraken accept the
// subscription — the point at which the feed is actually usable.
const startAndSubscribe = (symbols = ['btc', 'eth']) => {
  const stop = startKrakenTicker(symbols, dispatch as unknown as AppDispatch);
  latest().onopen?.();
  latest().onmessage?.(subscribeReply());
  return stop;
};

describe('startKrakenTicker', () => {
  it('subscribes to every symbol as a USD pair on one connection', () => {
    // Arrange / Act
    startAndSubscribe(['btc', 'eth']);

    // Assert — one socket, both pairs
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(JSON.parse(latest().sent[0])).toEqual({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: ['BTC/USD', 'ETH/USD'] },
    });
  });

  it('stays connecting while the transport is open but unacknowledged', () => {
    // Arrange / Act — opened, subscribe sent, no reply yet
    startKrakenTicker(['btc'], dispatch as unknown as AppDispatch);
    latest().onopen?.();

    // Assert — an open socket says nothing about whether Kraken accepted us
    expect(dispatch).not.toHaveBeenCalledWith(socketStatusChanged('live'));
  });

  it('reports live once Kraken acknowledges the subscription', () => {
    // Arrange / Act
    startAndSubscribe();

    // Assert
    expect(dispatch).toHaveBeenCalledWith(socketStatusChanged('live'));
  });

  it('does not report live when the subscription is rejected', () => {
    // Arrange
    startKrakenTicker(['btc'], dispatch as unknown as AppDispatch);
    latest().onopen?.();

    // Act — Kraken answers, and refuses
    latest().onmessage?.(subscribeReply(false));

    // Assert — a rejected feed showing "Live" is the worst of both
    expect(dispatch).not.toHaveBeenCalledWith(socketStatusChanged('live'));
  });

  it('coalesces a burst of ticks into a single dispatch per flush window', () => {
    // Arrange
    startAndSubscribe();

    // Act — three ticks inside one 250ms window
    for (const last of [1, 2, 3]) {
      latest().onmessage?.(
        tickerMessage([{ symbol: 'BTC/USD', last, change_pct: 1 }]),
      );
    }
    jest.advanceTimersByTime(250);

    // Assert — one dispatch, not three: this is what bounds the re-render rate
    const ticks = dispatch.mock.calls.filter(
      (call) => call[0].type === tickersApplied.type,
    );
    expect(ticks).toHaveLength(1);
  });

  it('keeps only the latest tick per symbol within a window', () => {
    // Arrange
    startAndSubscribe();

    // Act
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 1, change_pct: 1 }]),
    );
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 99, change_pct: 2 }]),
    );
    jest.advanceTimersByTime(250);

    // Assert — stale prices are dropped, not queued
    expect(dispatch).toHaveBeenCalledWith(
      tickersApplied([{ symbol: 'BTC', last: 99 }]),
    );
  });

  it("strips the quote currency, matching the store's symbol keys", () => {
    // Arrange
    startAndSubscribe();

    // Act
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 5, change_pct: 1 }]),
    );
    jest.advanceTimersByTime(250);

    // Assert — 'BTC/USD' → 'BTC'; a mismatch here renders nothing at all
    expect(dispatch).toHaveBeenCalledWith(
      tickersApplied([{ symbol: 'BTC', last: 5 }]),
    );
  });

  // The frame carries Kraken's own 24h change. The percentage on screen is
  // CoinGecko's, measured across exchanges — same window, different market — so
  // this must arrive at the store carrying the price and nothing else.
  it("leaves Kraken's own 24h change in the frame it came in", () => {
    // Arrange
    startAndSubscribe();

    // Act
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 5, change_pct: 99 }]),
    );
    jest.advanceTimersByTime(250);

    // Assert — deep equality: an extra field here is the bug
    expect(dispatch).toHaveBeenCalledWith(
      tickersApplied([{ symbol: 'BTC', last: 5 }]),
    );
  });

  it('does not dispatch when nothing arrived in the window', () => {
    // Arrange
    startAndSubscribe();
    dispatch.mockClear();

    // Act
    jest.advanceTimersByTime(1000);

    // Assert — an idle market must not churn the store
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ignores messages from other channels', () => {
    // Arrange
    startAndSubscribe();
    dispatch.mockClear();

    // Act
    latest().onmessage?.({
      data: JSON.stringify({ channel: 'heartbeat', data: [] }),
    });
    jest.advanceTimersByTime(250);

    // Assert
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('survives malformed JSON without throwing', () => {
    // Arrange
    startAndSubscribe();

    // Act / Assert
    expect(() => latest().onmessage?.({ data: 'not json{' })).not.toThrow();
  });

  it('reports the socket down when it closes', () => {
    // Arrange
    startAndSubscribe();

    // Act
    latest().onclose?.();

    // Assert
    expect(dispatch).toHaveBeenCalledWith(socketStatusChanged('offline'));
  });

  it('reports not-updating when an open feed goes silent', () => {
    // Arrange
    startAndSubscribe();
    dispatch.mockClear();

    // Act — the socket never closes; nothing arrives, not even a heartbeat
    jest.advanceTimersByTime(10_000);

    // Assert — frozen prices under a "Live" badge is the failure worth naming
    expect(dispatch).toHaveBeenCalledWith(socketStatusChanged('stale'));
  });

  it('returns to live when a frame arrives after silence', () => {
    // Arrange
    startAndSubscribe();
    jest.advanceTimersByTime(10_000);
    dispatch.mockClear();

    // Act
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 5, change_pct: 1 }]),
    );

    // Assert
    expect(dispatch).toHaveBeenCalledWith(socketStatusChanged('live'));
  });

  it('treats a heartbeat as proof the feed is alive', () => {
    // Arrange
    startAndSubscribe();
    dispatch.mockClear();

    // Act — a quiet market: heartbeats, no ticks, well past the stale window
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(5_000);
      latest().onmessage?.({ data: JSON.stringify({ channel: 'heartbeat' }) });
    }

    // Assert — quiet is not the same as broken
    expect(dispatch).not.toHaveBeenCalledWith(socketStatusChanged('stale'));
  });

  it('reconnects after a drop', () => {
    // Arrange
    startAndSubscribe();

    // Act
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Assert
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('backs off exponentially across repeated failures', () => {
    // Arrange
    startAndSubscribe();

    // Act — first retry at 1s
    latest().onclose?.();
    jest.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // second retry waits longer than the first
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Assert — still 2: 1s is no longer enough
    expect(FakeWebSocket.instances).toHaveLength(2);
    jest.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('resets the backoff once a subscription is acknowledged', () => {
    // Arrange — fail once so the backoff grows
    startAndSubscribe();
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Act — the retry connects, is acknowledged, then drops again
    latest().onopen?.();
    latest().onmessage?.(subscribeReply());
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Assert — back to a 1s retry, not a compounding one
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('keeps backing off when a connection opens but never acknowledges', () => {
    // Arrange — one failure, so the next wait is 2s
    startAndSubscribe();
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Act — a server that accepts the socket and drops it without subscribing
    latest().onopen?.();
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Assert — still 2 sockets: resetting on open would spin here at one
    // reconnect a second, for as long as the server kept accepting
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('drops ticks left buffered by a connection that died', () => {
    // Arrange — a tick lands, but the flush window has not elapsed yet
    startAndSubscribe();
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 1, change_pct: 1 }]),
    );

    // Act — the socket drops, and a reconnect starts a fresh flush timer
    latest().onclose?.();
    jest.advanceTimersByTime(1000);
    latest().onopen?.();
    latest().onmessage?.(subscribeReply());
    jest.advanceTimersByTime(250);

    // Assert — a price from before the drop must not surface as a current one
    const ticks = dispatch.mock.calls.filter(
      (call) => call[0].type === tickersApplied.type,
    );
    expect(ticks).toHaveLength(0);
  });

  it('ignores a frame from a connection it has already replaced', () => {
    // Arrange — keep a handle on the socket that is about to be superseded
    startAndSubscribe();
    const superseded = latest();
    superseded.onclose?.();
    jest.advanceTimersByTime(1000);
    latest().onopen?.();
    latest().onmessage?.(subscribeReply());
    dispatch.mockClear();

    // Act — the dead socket delivers late
    superseded.onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 99, change_pct: 1 }]),
    );
    jest.advanceTimersByTime(250);

    // Assert
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('closes the socket when stopped', () => {
    // Arrange
    const stop = startAndSubscribe();
    const socket = latest();

    // Act
    stop();

    // Assert
    expect(socket.closed).toBe(true);
  });

  it('stops flushing once stopped', () => {
    // Arrange
    const stop = startAndSubscribe();
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 1, change_pct: 1 }]),
    );

    // Act
    stop();
    dispatch.mockClear();
    jest.advanceTimersByTime(1000);

    // Assert — no dispatching into a store that is going away
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not reconnect after being stopped', () => {
    // Arrange
    const stop = startAndSubscribe();

    // Act — a close racing with unmount must not resurrect the socket
    stop();
    latest().onclose?.();
    jest.advanceTimersByTime(30_000);

    // Assert
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('closes the socket on error, so the close path drives the reconnect', () => {
    // Arrange
    startAndSubscribe();
    const socket = latest();

    // Act
    socket.onerror?.();

    // Assert
    expect(socket.closed).toBe(true);
  });
});
