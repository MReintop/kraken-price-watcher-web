import { fetchWithRetry, retryDelayMs } from './http';

const throttled = { ok: false, status: 429, headers: { get: () => null } };
const ok = { ok: true, status: 200, headers: { get: () => null } };

describe('retryDelayMs', () => {
  it('honours a Retry-After header over its own backoff', () => {
    // Arrange / Act
    const result = retryDelayMs(0, '3');

    // Assert
    expect(result).toBe(3000);
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
});
