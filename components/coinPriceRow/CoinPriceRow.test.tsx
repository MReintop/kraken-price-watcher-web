import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { makeStore } from '@/store/store';
import { tickersApplied, type SocketStatus } from '@/store/pricesSlice';
import type { ChangePillVariant } from '@/lib/experiments';
import CoinPriceRow from './CoinPriceRow';

// Arrange helper: the price comes from the store, the change from a prop —
// which is the split under test as much as anything else here.
const renderWithStore = (
  bySymbol: Record<string, number>,
  changePct: number | null = -1.45,
  unavailable: string[] = [],
  status: SocketStatus = 'live',
  changePillVariant: ChangePillVariant = 'control',
) => {
  const store = makeStore({
    prices: { bySymbol, status, unavailable },
  });
  render(
    <Provider store={store}>
      <CoinPriceRow
        priceDecimals={1}
        symbol="btc"
        changePct24H={changePct}
        changePillVariant={changePillVariant}
      />
    </Provider>,
  );
  return store;
};

const pill = () => screen.getByTitle(/24h change/);

describe('CoinPriceRow', () => {
  // A tick cannot reach `changePct` — it is a prop — so that guard lives in
  // store/krakenSocket.test.ts, where a frame's change_pct can actually try.
  it('names a symbol the feed carries no price for, rather than showing it as live', () => {
    // Arrange / Act — the feed is live; Kraken just refused this symbol
    renderWithStore({ BTC: 62888 }, -1.45, ['BTC']);

    // Assert
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('$62,888.0')).toHaveClass('priceStale');
  });

  it('says nothing of the sort for a symbol that is ticking', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, -1.45, ['ETH']);

    // Assert — a neighbour's rejection is not this row's problem
    expect(screen.queryByText('Not available')).not.toBeInTheDocument();
    expect(screen.getByText('$62,888.0')).not.toHaveClass('priceStale');
  });

  it('mutes the price when the feed itself has stopped updating', () => {
    // Arrange / Act — nothing refused; the socket has simply gone silent
    renderWithStore({ BTC: 62888 }, -1.45, [], 'stale');

    // Assert — the last price we were given must not read as the last one
    // traded. The feed's own state is named once, above the list.
    expect(screen.getByText('$62,888.0')).toHaveClass('priceStale');
    expect(screen.queryByText('Not available')).not.toBeInTheDocument();
  });

  it('mutes the price while the feed is offline', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, -1.45, [], 'offline');

    // Assert
    expect(screen.getByText('$62,888.0')).toHaveClass('priceStale');
  });

  it('leaves a seeded price plain while the socket is still connecting', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, -1.45, [], 'connecting');

    // Assert — that price is the server's own, and current until the feed
    // says otherwise; muting it on every page load would say nothing
    expect(screen.getByText('$62,888.0')).not.toHaveClass('priceStale');
  });

  it('renders the seeded price and change for its symbol', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 });

    // Assert — exact: a regex on the digits alone passes on a malformed sign
    expect(screen.getByText(/62,888\.0/)).toBeInTheDocument();
    expect(screen.getByText('-1.45%')).toBeInTheDocument();
  });

  it('re-renders with the new price when a tick for its symbol arrives', () => {
    // Arrange
    const store = renderWithStore({ BTC: 62888 });

    // Act
    act(() => {
      store.dispatch(tickersApplied([{ symbol: 'BTC', last: 63000 }]));
    });

    // Assert
    expect(screen.getByText(/63,000/)).toBeInTheDocument();
  });

  it('renders nothing when its symbol is absent from the store', () => {
    // Arrange
    const store = makeStore({
      prices: { bySymbol: {}, status: 'live', unavailable: [] },
    });

    // Act
    const { container } = render(
      <Provider store={store}>
        <CoinPriceRow
          priceDecimals={1}
          symbol="btc"
          changePct24H={1}
          changePillVariant={'control'}
        />
      </Provider>,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CoinPriceRow change pill', () => {
  it('adds the arrow for the treatment and nothing for control', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, 2.5, [], 'live', 'arrow');

    // Assert
    expect(pill()).toHaveTextContent('▲');
    expect(pill()).toHaveTextContent('+2.50%');
  });

  it('leaves control exactly as it shipped', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, 2.5, [], 'live', 'control');

    // Assert
    expect(pill()).not.toHaveTextContent('▲');
    expect(pill()).toHaveTextContent('+2.50%');
  });

  it('keeps the arrow out of the accessible text, so both arms read alike', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, 2.5, [], 'live', 'arrow');

    // Assert — the sign already says which way it went; announcing the glyph
    // beside it makes the treatment a screen-reader change too
    expect(pill().querySelector('[aria-hidden="true"]')).toHaveTextContent('▲');
  });

  it('presents a flat market as neither a rise nor a fall', () => {
    // Arrange / Act — this experiment is about direction, and zero has none
    renderWithStore({ BTC: 62888 }, 0, [], 'live', 'arrow');

    // Assert — no arrow, no '+', and the neutral pill
    expect(pill()).toHaveTextContent(/^0\.00%$/);
    expect(pill()).toHaveClass('pillFlat');
  });

  it('says nothing at all when the upstream had no figure', () => {
    // Arrange / Act
    renderWithStore({ BTC: 62888 }, null, [], 'live', 'arrow');

    // Assert — an em dash, not an arrow pointing at data that does not exist
    expect(pill()).toHaveTextContent(/^—$/);
    expect(pill()).toHaveClass('pillFlat');
  });
});
