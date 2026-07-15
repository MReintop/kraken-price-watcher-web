import { fetchKrakenPrices, fetchKrakenCandles } from './kraken';

const envelope = (result: unknown, error: string[] = []) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ error, result }),
});

const ohlcRow = (time: number, close: string) => [
  time,
  '100.0',
  '110.0',
  '90.0',
  close,
  '100.0',
  '1.0',
  10,
];

afterEach(() => jest.resetAllMocks());

describe('fetchKrakenPrices', () => {
  it('reads the last trade price for each pair', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        XXBTZUSD: { c: ['64788.0', '1.0'], o: '64000.0' },
      }),
    ) as unknown as typeof fetch;

    // Act
    const prices = await fetchKrakenPrices(['XXBTZUSD']);

    // Assert
    expect(prices.get('XXBTZUSD')?.last).toBe(64788);
  });

  it('derives the 24h change from the opening price', async () => {
    // Arrange — 110 now against an open of 100
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        SOLUSD: { c: ['110.0', '1.0'], o: '100.0' },
      }),
    ) as unknown as typeof fetch;

    // Act
    const prices = await fetchKrakenPrices(['SOLUSD']);

    // Assert
    expect(prices.get('SOLUSD')?.changePct).toBeCloseTo(10);
  });

  it('reports a fall as a negative change', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        SOLUSD: { c: ['90.0', '1.0'], o: '100.0' },
      }),
    ) as unknown as typeof fetch;

    // Act
    const prices = await fetchKrakenPrices(['SOLUSD']);

    // Assert
    expect(prices.get('SOLUSD')?.changePct).toBeCloseTo(-10);
  });

  it('asks for every pair in one request', async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(envelope({}));
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchKrakenPrices(['XXBTZUSD', 'SOLUSD']);

    // Assert — one call, not one per pair
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('pair=XXBTZUSD,SOLUSD');
  });

  it('keys by the pair name, since Kraken does not answer in the order asked', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        SOLUSD: { c: ['142.5', '1.0'], o: '140.0' },
        XXBTZUSD: { c: ['64788.0', '1.0'], o: '64000.0' },
      }),
    ) as unknown as typeof fetch;

    // Act
    const prices = await fetchKrakenPrices(['XXBTZUSD', 'SOLUSD']);

    // Assert
    expect(prices.get('XXBTZUSD')?.last).toBe(64788);
    expect(prices.get('SOLUSD')?.last).toBe(142.5);
  });

  it('treats a zero open as no change rather than dividing by it', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        SOLUSD: { c: ['10.0', '1.0'], o: '0' },
      }),
    ) as unknown as typeof fetch;

    // Act
    const prices = await fetchKrakenPrices(['SOLUSD']);

    // Assert
    expect(prices.get('SOLUSD')?.changePct).toBe(0);
  });

  it('throws on an error body, which Kraken sends with HTTP 200', async () => {
    // Arrange — response.ok is true here; only the error array reveals the failure
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({}, ['EQuery:Unknown asset pair']),
      ) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenPrices(['NOPE'])).rejects.toThrow(
      'Unknown asset pair',
    );
  });
});

describe('fetchKrakenCandles', () => {
  it('converts string prices and second-precision timestamps', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        XXBTZUSD: [ohlcRow(1_700_000_000, '105.0')],
        last: 1_700_000_000,
      }),
    ) as unknown as typeof fetch;

    // Act
    const candles = await fetchKrakenCandles('XXBTZUSD', 30);

    // Assert — milliseconds and numbers, as the chart expects
    expect(candles).toEqual([
      { t: 1_700_000_000_000, o: 100, h: 110, l: 90, c: 105 },
    ]);
  });

  it('ignores the `last` cursor Kraken returns alongside the rows', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        SOLUSD: [ohlcRow(1_700_000_000, '105.0')],
        last: 1_700_000_000,
      }),
    ) as unknown as typeof fetch;

    // Act
    const candles = await fetchKrakenCandles('SOLUSD', 30);

    // Assert
    expect(candles).toHaveLength(1);
  });

  it('requests hourly candles for the 24h timeframe', async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValue(envelope({ SOLUSD: [], last: 0 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchKrakenCandles('SOLUSD', 1);

    // Assert
    expect(fetchMock.mock.calls[0][0]).toContain('interval=60');
  });

  it('requests weekly candles for the 1Y timeframe', async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValue(envelope({ SOLUSD: [], last: 0 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchKrakenCandles('SOLUSD', 365);

    // Assert
    expect(fetchMock.mock.calls[0][0]).toContain('interval=10080');
  });

  it('keeps only the most recent candles for the timeframe', async () => {
    // Arrange — Kraken returns far more rows than a 24h chart needs
    const rows = Array.from({ length: 100 }, (_, i) =>
      ohlcRow(1_700_000_000 + i * 3600, String(i)),
    );
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ SOLUSD: rows, last: 0 }),
      ) as unknown as typeof fetch;

    // Act
    const candles = await fetchKrakenCandles('SOLUSD', 1);

    // Assert — the tail, so the chart ends at "now"
    expect(candles).toHaveLength(24);
    expect(candles[candles.length - 1].c).toBe(99);
  });

  it('falls back to the 1M timeframe for an unknown range', async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValue(envelope({ SOLUSD: [], last: 0 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchKrakenCandles('SOLUSD', 7);

    // Assert
    expect(fetchMock.mock.calls[0][0]).toContain('interval=1440');
  });

  it('throws on an unknown pair, which Kraken reports with HTTP 200', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({}, ['EQuery:Unknown asset pair']),
      ) as unknown as typeof fetch;

    // Act / Assert — the silent-empty-chart trap
    await expect(fetchKrakenCandles('NOPE', 30)).rejects.toThrow(
      'Unknown asset pair',
    );
  });

  it('throws when the response carries no rows at all', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(envelope({ last: 0 })) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenCandles('SOLUSD', 30)).rejects.toThrow(
      'no candles',
    );
  });
});
