import { fetchKrakenPrices, fetchKrakenCandles } from './kraken';

const envelope = (result: unknown, error: string[] = []) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => ({ error, result }),
});

// Kraken's rows satisfy l <= o,c <= h, and lib/kraken.ts rejects any that do
// not — so the wick stretches to whatever close a test asks for.
const ohlcRow = (time: number, close: string) => [
  time,
  '100.0',
  String(Math.max(110, Number(close))),
  String(Math.min(90, Number(close))),
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
    expect(prices.get('XXBTZUSD')).toBe(64788);
  });

  // `o` is today's open, not a 24h open, so no 24h change can be derived from
  // this endpoint. The seed comes from CoinGecko instead — see lib/coins.ts.
  it('ignores the opening price the ticker also carries', async () => {
    // Arrange — an `o` that would read as +10% if it were used
    global.fetch = jest.fn().mockResolvedValue(
      envelope({
        SOLUSD: { c: ['110.0', '1.0'], o: '100.0' },
      }),
    ) as unknown as typeof fetch;

    // Act
    const prices = await fetchKrakenPrices(['SOLUSD']);

    // Assert — the price, and nothing derived from `o`
    expect(prices.get('SOLUSD')).toBe(110);
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
    expect(prices.get('XXBTZUSD')).toBe(64788);
    expect(prices.get('SOLUSD')).toBe(142.5);
  });

  // Number('') is 0, and so are Number(null), Number(false) and Number([]) —
  // each one a finite number, and each one a real-looking $0.00 on a price row.
  it.each([
    ['an empty string', ''],
    ['null', null],
    ['false', false],
    ['an array', []],
    ['a nested array', ['64788.0']],
    ['undefined', undefined],
    ['a non-numeric string', 'sixty thousand'],
  ])('rejects a last price given as %s', async (_label, price) => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ XXBTZUSD: { c: [price, '1.0'] } }),
      ) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenPrices(['XXBTZUSD'])).rejects.toThrow(
      'expected a number',
    );
  });

  it.each([
    ['zero', '0'],
    ['a negative price', '-64788.0'],
  ])('rejects a last price of %s, which is not a trade', async (_l, price) => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ XXBTZUSD: { c: [price, '1.0'] } }),
      ) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenPrices(['XXBTZUSD'])).rejects.toThrow(
      'expected a positive price',
    );
  });

  // Valid JSON says nothing about being this API: a proxy error page parses too.
  it.each([
    ['is not an object', 'gateway timeout'],
    ['is null', null],
    ['carries no error array', { result: {} }],
    ['carries no result object', { error: [] }],
    ['carries a non-object result', { error: [], result: 'nope' }],
  ])('rejects an envelope that %s', async (_label, body) => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    }) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenPrices(['XXBTZUSD'])).rejects.toThrow(
      'unrecognised response envelope',
    );
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
      ohlcRow(1_700_000_000 + i * 3600, String(i + 1)),
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
    expect(candles[candles.length - 1].c).toBe(100);
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

  it('rejects a candle field that is empty rather than reading it as zero', async () => {
    // Arrange — an empty close, which Number() would call a $0 candle
    const row = [
      1_700_000_000,
      '100.0',
      '110.0',
      '90.0',
      '',
      '100.0',
      '1.0',
      10,
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ XXBTZUSD: [row], last: 0 }),
      ) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenCandles('XXBTZUSD', 30)).rejects.toThrow(
      'expected a number',
    );
  });

  it('rejects a candle whose body falls outside its own wick', async () => {
    // Arrange — a low above the close: not a candle that could have traded
    const row = [
      1_700_000_000,
      '100.0',
      '110.0',
      '99.0',
      '95.0',
      '100.0',
      '1.0',
      10,
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ XXBTZUSD: [row], last: 0 }),
      ) as unknown as typeof fetch;

    // Act / Assert — the geometry would draw this without complaint
    await expect(fetchKrakenCandles('XXBTZUSD', 30)).rejects.toThrow(
      'not self-consistent',
    );
  });

  it('rejects a candle timestamped at the epoch', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ XXBTZUSD: [ohlcRow(0, '105.0')], last: 0 }),
      ) as unknown as typeof fetch;

    // Act / Assert — one 1970 row stretches the x-axis across half a century
    await expect(fetchKrakenCandles('XXBTZUSD', 30)).rejects.toThrow(
      'expected a timestamp',
    );
  });

  it('rejects a row that is not a row', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        envelope({ XXBTZUSD: ['not a candle'], last: 0 }),
      ) as unknown as typeof fetch;

    // Act / Assert
    await expect(fetchKrakenCandles('XXBTZUSD', 30)).rejects.toThrow(
      'expected a row',
    );
  });

  it('refuses an unmapped timeframe instead of serving another one', async () => {
    // Arrange
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act / Assert — falling back would answer "7d" with 30-day candles
    await expect(fetchKrakenCandles('SOLUSD', 7)).rejects.toThrow(
      'No timeframe is mapped for 7 days',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
