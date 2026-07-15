'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import type { Coin } from '@/lib/coins';
import { makeStore } from '@/store/store';
import { seedPricesFromCoins } from '@/store/pricesSlice';
import { startKrakenTicker } from '@/store/krakenSocket';

interface StoreProviderProps {
  initialCoins: Coin[];
  children: React.ReactNode;
}

export default function StoreProvider({
  initialCoins,
  children,
}: StoreProviderProps) {
  // Created once per mount, never as a module singleton: a shared store would
  // leak state between server requests. useState (not useRef) so it is readable
  // during render.
  const [store] = useState(() =>
    makeStore({ prices: seedPricesFromCoins(initialCoins) }),
  );
  // Frozen at mount so the socket effect has stable deps and never reconnects.
  const [symbols] = useState(() => initialCoins.map((coin) => coin.symbol));

  useEffect(() => startKrakenTicker(symbols, store.dispatch), [store, symbols]);

  return <Provider store={store}>{children}</Provider>;
}
