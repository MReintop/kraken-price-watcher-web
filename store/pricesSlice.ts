import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Coin } from '@/lib/coins';
import type { RootState } from './store';

export interface KrakenTick {
  symbol: string;
  last: number;
}

// An open socket is not a working feed. `live` means Kraken acknowledged the
// subscription *and* has sent something since; `stale` is the dangerous state a
// boolean cannot express — connected, believed healthy, and silently frozen.
export type SocketStatus = 'connecting' | 'live' | 'stale' | 'offline';

// The last traded price and nothing else. The 24h change is CoinGecko's and
// server data, so it reaches the row as a prop — beside a Kraken price in one
// record, something eventually overwrites it with Kraken's.
export interface PricesState {
  bySymbol: Record<string, number>;
  status: SocketStatus;
  // Symbols Kraken refused, or never answered for. The connection can be healthy
  // while one instrument is not, and a global flag cannot say which.
  unavailable: string[];
}

const initialState: PricesState = {
  bySymbol: {},
  status: 'connecting',
  unavailable: [],
};

export function seedPricesFromCoins(coins: Coin[]): PricesState {
  return {
    bySymbol: Object.fromEntries(
      coins.map((coin) => [coin.symbol.toUpperCase(), coin.current_price]),
    ),
    // The seed is server data, not a feed. Only an acknowledged subscription
    // may promote this to live.
    status: 'connecting',
    unavailable: [],
  };
}

const pricesSlice = createSlice({
  name: 'prices',
  initialState,
  reducers: {
    tickersApplied(state, action: PayloadAction<KrakenTick[]>) {
      for (const tick of action.payload) {
        // Repeat trades at one price level are common, and re-assigning the same
        // number would still churn the store for a row that has not changed.
        if (state.bySymbol[tick.symbol] === tick.last) continue;
        state.bySymbol[tick.symbol] = tick.last;
      }
    },
    socketStatusChanged(state, action: PayloadAction<SocketStatus>) {
      state.status = action.payload;
    },
    // Sent once per connection, when every symbol has been answered for or the
    // handshake deadline has passed.
    subscriptionsSettled(state, action: PayloadAction<string[]>) {
      state.unavailable = action.payload;
    },
  },
});

export const { tickersApplied, socketStatusChanged, subscriptionsSettled } =
  pricesSlice.actions;
export default pricesSlice.reducer;

// Per-symbol, so a tick re-renders exactly the row it belongs to.
export const selectPrice = (symbol: string) => (s: RootState) =>
  s.prices.bySymbol[symbol];
export const selectSocketStatus = (s: RootState) => s.prices.status;

// A boolean per symbol rather than the array itself: a component re-renders when
// its own answer changes, not whenever any other symbol's does.
export const selectIsUnavailable = (symbol: string) => (s: RootState) =>
  s.prices.unavailable.includes(symbol);
