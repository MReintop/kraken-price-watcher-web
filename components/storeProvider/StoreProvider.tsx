'use client';

import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { marketFor, type Coin } from '@/lib/coins';
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
  // The registry entry, not the coin: what to subscribe to is Kraken's protocol
  // and ours to state, never something to read off CoinGecko's response.
  // Frozen at mount so the socket effect has stable deps and never reconnects.
  const [markets] = useState(() =>
    initialCoins.flatMap((coin) => marketFor(coin.id) ?? []),
  );

  useEffect(() => startKrakenTicker(markets, store.dispatch), [store, markets]);

  return <Provider store={store}>{children}</Provider>;
}
