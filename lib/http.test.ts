import { AbortedError, fetchWithRetry, retryDelayMs } from './http';

const throttled = { ok: false, status: 429, headers: { get: () => null } };
const ok = { ok: true, status: 200, headers: { get: () => null } };

describe('retryDelayMs', () => {
  it('honours a Retry-After header over its own backoff', () => {
    // Arrange / Act
    const result = retryDelayMs(0, '3');

    // Assert
    expect(result).toBe(3000);
  });

  it('caps a Retry-After asking for longer than anyone will wait', () => {
    // Arrange / Act — an upstream asking for an hour
    const result = retryDelayMs(0, '3600');

    // Assert — one upstream's say-so cannot hold a build worker for an hour
    expect(result).toBe(30_000);
  });

  it('ignores a Retry-After that is not a positive number', () => {
    // Arrange / Act
    const result = retryDelayMs(0, 'later');

    // Assert
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('grows with each attempt', () => {
    // Arrange — pin the jitter so only the backoff varies
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    // Act
    const first = retryDelayMs(0, null);
    const third = retryDelayMs(2, null);

    // Assert
    expect(third).toBeGreaterThan(first);
  });

  it('jitters, so parallel workers do not retry in lockstep', () => {
    // Arrange / Act — same attempt, different random draws
    jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(1);
    const low = retryDelayMs(1, null);
    const high = retryDelayMs(1, null);

    // Assert
    expect(high).toBeGreaterThan(low);
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('returns a successful response without retrying', async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchWithRetry('https://example.test', {});

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a throttled request and returns the eventual success', async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(throttled)
      .mockResolvedValueOnce(ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {});
    await jest.advanceTimersByTimeAsync(5_000);

    // Assert
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after a bounded number of attempts', async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(throttled);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {});
    await jest.advanceTimersByTimeAsync(60_000);
    await pending;

    // Assert — bounded, so a dead upstream cannot hang a build forever
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not retry a client error it cannot recover from', async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {});
    await jest.advanceTimersByTimeAsync(60_000);
    await pending;

    // Assert — retrying a 404 only wastes the build's time
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a server error', async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce(ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {});
    await jest.advanceTimersByTimeAsync(5_000);
    await pending;

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // A dropped connection has no status to inspect, so a retry keyed only on
  // response codes never sees it — the first blip took the page down.
  it('retries a connection that throws instead of answering', async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {});
    await jest.advanceTimersByTimeAsync(5_000);

    // Assert
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a connection that never answers, rather than hanging', async () => {
    // Arrange
    const fetchMock = jest.fn().mockRejectedValue(new Error('TimeoutError'));
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {});
    const settled = expect(pending).rejects.toThrow('TimeoutError');
    await jest.advanceTimersByTimeAsync(60_000);
    await settled;

    // Assert — bounded attempts, then the caller is told, not left waiting
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  // The caller's abort and the attempt timeout arrive here as the same rejected
  // fetch, and only one of them is asking to be tried harder.
  it('does not retry a request the caller abandoned', async () => {
    // Arrange — the caller aborts mid-flight, as a superseded request does
    const controller = new AbortController();
    const fetchMock = jest.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new Error('AbortError'));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const pending = fetchWithRetry('https://example.test', {
      signal: controller.signal,
    });
    const settled = expect(pending).rejects.toThrow(AbortedError);
    await jest.advanceTimersByTimeAsync(60_000);
    await settled;

    // Assert — nobody is waiting for this answer
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops waiting out a backoff once the caller aborts', async () => {
    // Arrange — a 429 sends the retry into its backoff sleep
    const controller = new AbortController();
    const fetchMock = jest.fn().mockResolvedValue(throttled);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act — abort once the sleep is armed, not before it starts
    const pending = fetchWithRetry('https://example.test', {
      signal: controller.signal,
    });
    await jest.advanceTimersByTimeAsync(0);
    controller.abort();

    // Assert — the wait ends with the caller, rather than honouring a
    // Retry-After for a screen that is already gone
    await expect(pending).rejects.toThrow(AbortedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds every attempt with a timeout signal', async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(ok);
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchWithRetry('https://example.test', {});

    // Assert — without this, a hung upstream holds the worker indefinitely
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
