import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Coin } from '@/lib/coins';
import type { RootState } from './store';

export interface KrakenTick {
  symbol: string;
  last: number;
}

// `live` needs an ack for every symbol and a ticker since; `stale` is the one a
// boolean cannot express — connected, believed healthy, silently frozen.
export type SocketStatus = 'connecting' | 'live' | 'stale' | 'offline';

// A refused symbol has its own state, and it outranks a healthy global socket.
export type EffectiveStatus = SocketStatus | 'unavailable';

// Live prices only — identity and 24h change are server data, delivered as props.
export interface PricesState {
  bySymbol: Record<string, number>;
  status: SocketStatus;
  // Symbols Kraken refused: a healthy socket cannot say which instrument is not.
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
    // The seed is server data, not a feed: only a subscription promotes to live.
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
        // Skip an unchanged price: repeat trades at one level are common, and
        // re-assigning would churn the row for nothing.
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

// Per-symbol, so a row re-renders on its own answer, not any other symbol's: a
// live socket says nothing about an instrument it never agreed to send.
export const selectEffectiveStatus =
  (symbol: string) =>
  (s: RootState): EffectiveStatus =>
    s.prices.unavailable.includes(symbol) ? 'unavailable' : s.prices.status;
