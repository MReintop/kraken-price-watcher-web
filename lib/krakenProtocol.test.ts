import {
  baseOf,
  pairFor,
  parseFrame,
  readSubscribeReply,
  readTickers,
  subscribeRequest,
} from './krakenProtocol';

const SUBSCRIBED = new Set(['BTC/USD', 'ETH/USD']);

describe('pairFor', () => {
  it('builds the USD pair Kraken names, upper-cased', () => {
    // Arrange / Act
    const result = pairFor('btc');

    // Assert — a lower-case symbol reaches the store and matches nothing
    expect(result).toBe('BTC/USD');
  });
});

describe('baseOf', () => {
  it('cuts the pair down to the symbol the store is keyed by', () => {
    // Arrange / Act
    const result = baseOf('BTC/USD');

    // Assert
    expect(result).toBe('BTC');
  });
});

describe('subscribeRequest', () => {
  it('asks for the ticker channel for every pair at once', () => {
    // Arrange / Act
    const result = JSON.parse(subscribeRequest(['BTC/USD', 'ETH/USD']));

    // Assert
    expect(result).toEqual({
      method: 'subscribe',
      params: { channel: 'ticker', symbol: ['BTC/USD', 'ETH/USD'] },
    });
  });
});

describe('parseFrame', () => {
  it('reads a frame', () => {
    // Arrange / Act
    const result = parseFrame('{"channel":"ticker"}');

    // Assert
    expect(result).toEqual({ channel: 'ticker' });
  });

  it('returns null for anything that is not JSON', () => {
    // Arrange / Act
    const result = parseFrame('<html>502 Bad Gateway</html>');

    // Assert — a proxy erroring mid-stream sends this, and it must not throw
    // inside a socket handler
    expect(result).toBeNull();
  });

  it('returns null for JSON that is not an object', () => {
    // Arrange / Act / Assert — `null` parses fine and then reads as a frame
    expect(parseFrame('null')).toBeNull();
    expect(parseFrame('42')).toBeNull();
  });
});

describe('readSubscribeReply', () => {
  it('reads an acceptance', () => {
    // Arrange / Act
    const result = readSubscribeReply({
      method: 'subscribe',
      success: true,
      result: { symbol: 'BTC/USD' },
    });

    // Assert
    expect(result).toEqual({ pair: 'BTC/USD', accepted: true });
  });

  it('reads a refusal as an answer, not an absence', () => {
    // Arrange / Act
    const result = readSubscribeReply({
      method: 'subscribe',
      success: false,
      result: { symbol: 'ETH/USD' },
    });

    // Assert — a refused symbol is one we know we are not receiving
    expect(result).toEqual({ pair: 'ETH/USD', accepted: false });
  });

  it('treats a missing success as a refusal', () => {
    // Arrange / Act
    const result = readSubscribeReply({
      method: 'subscribe',
      result: { symbol: 'BTC/USD' },
    });

    // Assert — only an explicit yes is a yes
    expect(result?.accepted).toBe(false);
  });

  it('ignores a reply that names no symbol', () => {
    // Arrange / Act
    const result = readSubscribeReply({ method: 'subscribe', success: true });

    // Assert — it answers for nobody, so counting it would let one reply speak
    // for a symbol it never mentioned
    expect(result).toBeNull();
  });

  it('ignores a frame that is not a subscribe reply', () => {
    // Arrange / Act
    const result = readSubscribeReply({ channel: 'ticker', data: [] });

    // Assert
    expect(result).toBeNull();
  });
});

describe('readTickers', () => {
  it('reads a price', () => {
    // Arrange / Act
    const result = readTickers(
      { channel: 'ticker', data: [{ symbol: 'BTC/USD', last: 62888 }] },
      SUBSCRIBED,
    );

    // Assert
    expect(result).toEqual([{ pair: 'BTC/USD', last: 62888 }]);
  });

  it('drops a pair that was never subscribed to', () => {
    // Arrange / Act
    const result = readTickers(
      { channel: 'ticker', data: [{ symbol: 'DOGE/USD', last: 0.12 }] },
      SUBSCRIBED,
    );

    // Assert — it has no row to land in and would sit in the store unread
    expect(result).toEqual([]);
  });

  it('drops a price that is not a finite number', () => {
    // Arrange / Act
    const result = readTickers(
      {
        channel: 'ticker',
        data: [
          { symbol: 'BTC/USD', last: NaN },
          { symbol: 'ETH/USD', last: Infinity },
        ],
      },
      SUBSCRIBED,
    );

    // Assert — a non-finite price reaches chart geometry and draws nothing
    expect(result).toEqual([]);
  });

  it('drops a price sent as a string', () => {
    // Arrange / Act — the REST API quotes prices as strings, so this is the
    // shape a protocol change would most plausibly take
    const result = readTickers(
      { channel: 'ticker', data: [{ symbol: 'BTC/USD', last: '62888' }] },
      SUBSCRIBED,
    );

    // Assert — a cast would have let "62888" through as a number
    expect(result).toEqual([]);
  });

  it('keeps the readable rows of a partly broken frame', () => {
    // Arrange / Act
    const result = readTickers(
      {
        channel: 'ticker',
        data: [
          { symbol: 'BTC/USD', last: 62888 },
          { symbol: 'ETH/USD', last: null },
        ],
      },
      SUBSCRIBED,
    );

    // Assert — one bad row must not cost the other its price
    expect(result).toEqual([{ pair: 'BTC/USD', last: 62888 }]);
  });

  it('returns nothing for a frame from another channel', () => {
    // Arrange / Act
    const result = readTickers(
      { channel: 'heartbeat', data: [{ symbol: 'BTC/USD', last: 1 }] },
      SUBSCRIBED,
    );

    // Assert
    expect(result).toEqual([]);
  });

  it('returns nothing when data is not a list', () => {
    // Arrange / Act
    const result = readTickers(
      { channel: 'ticker' } as { channel: string },
      SUBSCRIBED,
    );

    // Assert
    expect(result).toEqual([]);
  });
});
