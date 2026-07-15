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

// The last traded price per symbol, and nothing else. The 24h change is not
// here on purpose: it is CoinGecko's, it is server data, and the moment it sits
// beside a Kraken price in one record something will overwrite it with Kraken's
// — a different venue under the same label. It reaches the row as a prop.
export interface PricesState {
  bySymbol: Record<string, number>;
  status: SocketStatus;
}

const initialState: PricesState = { bySymbol: {}, status: 'connecting' };

export function seedPricesFromCoins(coins: Coin[]): PricesState {
  return {
    bySymbol: Object.fromEntries(
      coins.map((coin) => [coin.symbol.toUpperCase(), coin.current_price]),
    ),
    // The seed is server data, not a feed. Only an acknowledged subscription
    // may promote this to live.
    status: 'connecting',
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
  },
});

export const { tickersApplied, socketStatusChanged } = pricesSlice.actions;
export default pricesSlice.reducer;

// Per-symbol, so a tick re-renders exactly the row it belongs to.
export const selectPrice = (symbol: string) => (s: RootState) =>
  s.prices.bySymbol[symbol];
export const selectSocketStatus = (s: RootState) => s.prices.status;
