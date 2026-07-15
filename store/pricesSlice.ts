import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Coin } from '@/lib/coins';
import type { RootState } from './store';

export interface KrakenTick {
  symbol: string;
  last: number;
  changePct: number;
}

export interface PricesState {
  bySymbol: Record<string, { last: number; changePct: number }>;
  live: boolean;
}

const initialState: PricesState = { bySymbol: {}, live: false };

export function seedPricesFromCoins(coins: Coin[]): PricesState {
  return {
    bySymbol: Object.fromEntries(
      coins.map((coin) => [
        coin.symbol.toUpperCase(),
        {
          last: coin.current_price,
          changePct: coin.price_change_percentage_24h,
        },
      ]),
    ),
    live: false,
  };
}

const pricesSlice = createSlice({
  name: 'prices',
  initialState,
  reducers: {
    tickersApplied(state, action: PayloadAction<KrakenTick[]>) {
      for (const tick of action.payload) {
        const held = state.bySymbol[tick.symbol];
        // Skipping an unchanged tick preserves the object identity, which is what
        // stops the row re-rendering. Repeat trades at one price level are common.
        if (held?.last === tick.last && held?.changePct === tick.changePct) {
          continue;
        }
        state.bySymbol[tick.symbol] = {
          last: tick.last,
          changePct: tick.changePct,
        };
      }
    },
    socketStatusChanged(state, action: PayloadAction<boolean>) {
      state.live = action.payload;
    },
  },
});

export const { tickersApplied, socketStatusChanged } = pricesSlice.actions;
export default pricesSlice.reducer;

// Per-symbol so a tick changes object identity for one row only, and just that
// row re-renders.
export const selectPrice = (symbol: string) => (s: RootState) =>
  s.prices.bySymbol[symbol];
export const selectLive = (s: RootState) => s.prices.live;
