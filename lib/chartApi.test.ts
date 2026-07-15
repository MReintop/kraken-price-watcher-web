import { fetchCandles } from './chartApi';

const candles = [{ t: 1000, o: 10, h: 12, l: 9, c: 11 }];

afterEach(() => jest.resetAllMocks());

describe('fetchCandles', () => {
  it('returns the candles from the route handler', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candles }),
    }) as unknown as typeof fetch;

    // Act
    const result = await fetchCandles('bitcoin', 30);

    // Assert
    expect(result).toEqual(candles);
  });

  it('requests the coin and timeframe given', async () => {
    // Arrange
    const mock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ candles: [] }) });
    global.fetch = mock as unknown as typeof fetch;

    // Act
    await fetchCandles('ethereum', 365);

    // Assert
    expect(mock).toHaveBeenCalledWith(
      '/api/chart/ethereum?days=365',
      expect.anything(),
    );
  });

  it('passes the abort signal through, so a switch can supersede the last one', async () => {
    // Arrange
    const mock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ candles: [] }) });
    global.fetch = mock as unknown as typeof fetch;
    const controller = new AbortController();

    // Act
    await fetchCandles('bitcoin', 1, controller.signal);

    // Assert
    expect(mock).toHaveBeenCalledWith(expect.any(String), {
      signal: controller.signal,
    });
  });

  it('throws on a non-ok response rather than reporting an empty chart', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    // Act / Assert — the caller decides what to show; this must not fail silently
    await expect(fetchCandles('bitcoin', 30)).rejects.toThrow('500');
  });

  it('names the coin and timeframe in the error, for a debuggable message', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchCandles('dogecoin', 7)).rejects.toThrow('dogecoin (7d)');
  });

  it('treats a response with no candles field as no candles', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    // Act
    const result = await fetchCandles('bitcoin', 30);

    // Assert
    expect(result).toEqual([]);
  });
});
