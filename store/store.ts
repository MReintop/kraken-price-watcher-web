import { configureStore } from '@reduxjs/toolkit';
import pricesReducer, { type PricesState } from './pricesSlice';

// A FACTORY, not a singleton
export const makeStore = (preloadedState?: { prices: PricesState }) =>
  configureStore({
    reducer: { prices: pricesReducer },
    preloadedState,
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
