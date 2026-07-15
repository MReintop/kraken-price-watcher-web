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

// Arrange helper: start the ticker and open its socket.
const startAndOpen = (symbols = ['btc', 'eth']) => {
  const stop = startKrakenTicker(symbols, dispatch as unknown as AppDispatch);
  latest().onopen?.();
  return stop;
};

describe('startKrakenTicker', () => {
  it('subscribes to every symbol as a USD pair on one connection', () => {
    // Arrange / Act
    startAndOpen(['btc', 'eth']);

    // Assert — one socket, both pairs
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(JSON.parse(latest().sent[0])).toEqual({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: ['BTC/USD', 'ETH/USD'] },
    });
  });

  it('reports the socket live once it opens', () => {
    // Arrange / Act
    startAndOpen();

    // Assert
    expect(dispatch).toHaveBeenCalledWith(socketStatusChanged(true));
  });

  it('coalesces a burst of ticks into a single dispatch per flush window', () => {
    // Arrange
    startAndOpen();

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
    startAndOpen();

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
      tickersApplied([{ symbol: 'BTC', last: 99, changePct: 2 }]),
    );
  });

  it("strips the quote currency, matching the store's symbol keys", () => {
    // Arrange
    startAndOpen();

    // Act
    latest().onmessage?.(
      tickerMessage([{ symbol: 'BTC/USD', last: 5, change_pct: 1 }]),
    );
    jest.advanceTimersByTime(250);

    // Assert — 'BTC/USD' → 'BTC'; a mismatch here renders nothing at all
    expect(dispatch).toHaveBeenCalledWith(
      tickersApplied([{ symbol: 'BTC', last: 5, changePct: 1 }]),
    );
  });

  it('does not dispatch when nothing arrived in the window', () => {
    // Arrange
    startAndOpen();
    dispatch.mockClear();

    // Act
    jest.advanceTimersByTime(1000);

    // Assert — an idle market must not churn the store
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ignores messages from other channels', () => {
    // Arrange
    startAndOpen();
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
    startAndOpen();

    // Act / Assert
    expect(() => latest().onmessage?.({ data: 'not json{' })).not.toThrow();
  });

  it('reports the socket down when it closes', () => {
    // Arrange
    startAndOpen();

    // Act
    latest().onclose?.();

    // Assert
    expect(dispatch).toHaveBeenCalledWith(socketStatusChanged(false));
  });

  it('reconnects after a drop', () => {
    // Arrange
    startAndOpen();

    // Act
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Assert
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('backs off exponentially across repeated failures', () => {
    // Arrange
    startAndOpen();

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

  it('resets the backoff once a connection succeeds', () => {
    // Arrange — fail once so the backoff grows
    startAndOpen();
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Act — the retry connects successfully, then drops again
    latest().onopen?.();
    latest().onclose?.();
    jest.advanceTimersByTime(1000);

    // Assert — back to a 1s retry, not a compounding one
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('closes the socket when stopped', () => {
    // Arrange
    const stop = startAndOpen();
    const socket = latest();

    // Act
    stop();

    // Assert
    expect(socket.closed).toBe(true);
  });

  it('stops flushing once stopped', () => {
    // Arrange
    const stop = startAndOpen();
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
    const stop = startAndOpen();

    // Act — a close racing with unmount must not resurrect the socket
    stop();
    latest().onclose?.();
    jest.advanceTimersByTime(30_000);

    // Assert
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('closes the socket on error, so the close path drives the reconnect', () => {
    // Arrange
    startAndOpen();
    const socket = latest();

    // Act
    socket.onerror?.();

    // Assert
    expect(socket.closed).toBe(true);
  });
});
