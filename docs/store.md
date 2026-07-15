# The store

Redux Toolkit, deliberately small. **The store holds only what cannot live on the server**: live WebSocket ticks and socket status. The coin list, market summary and initial candles are all server-fetched by React Server Components and passed down as props — none of that is in Redux, and none of it should be.

That split is the whole design. If you find yourself adding server data to the store, the answer is almost always a server component instead.

## The pieces

```
store/store.ts         makeStore() — a FACTORY, never a module singleton
store/pricesSlice.ts   the only slice: bySymbol + live, plus seedPricesFromCoins()
store/krakenSocket.ts  one WebSocket for every symbol; buffers + coalesces ticks
store/hooks.ts         typed useAppSelector / useAppDispatch
components/storeProvider/StoreProvider.tsx   the 'use client' boundary that owns both
```

## The flow

```
app/layout.tsx (server component)
  └─ await getCoins()                    ← server fetch, once per request
      └─ <StoreProvider initialCoins>    ← 'use client' boundary
          ├─ makeStore({ prices: seedPricesFromCoins(initialCoins) })
          │     first paint already has real prices — no spinner, no round-trip
          ├─ startKrakenTicker(symbols, store.dispatch)
          │     one socket → buffer → one dispatch per 250ms
          └─ <Provider> → CoinPriceRow / CoinPriceHeader / CoinChart
                each reads ONLY its own symbol via selectPrice(SYMBOL)
```

## Why it's built this way

- **`makeStore` is a factory.** A module-level store instance is shared across requests on the server and leaks one user's state into another's. The store is created per-mount inside the client boundary instead.
- **`StoreProvider` uses lazy `useState`, not `useRef`.** Same create-once-per-mount guarantee, but the value is readable during render — reading `ref.current` in render trips `react-hooks/refs` and is genuinely unsafe.
- **The store is seeded from server data.** `seedPricesFromCoins` preloads `bySymbol` so the server-rendered HTML contains real prices. This is what the JS-disabled test in `e2e/markets.spec.ts` pins down.
- **`live` starts `false`.** The seed is server data, not a live feed. Only `socketStatusChanged(true)` may set it.
- **One socket, not one per row.** `startKrakenTicker` subscribes to every symbol on a single connection.
- **Ticks are coalesced.** Incoming ticks land in a `Map` keyed by symbol (latest wins) and flush as a _single_ `tickersApplied` dispatch every 250ms. Kraken pushes far faster than any UI needs; this bounds re-render rate regardless of market activity.
- **Selectors are per-symbol.** `selectPrice(symbol)` returns just that symbol's object, so a tick changes object identity for exactly one row and only that row re-renders. This is why the list stays cheap with a live feed.

## Invariants — break these and things fail silently

- **Symbols are UPPERCASE in the store.** CoinGecko returns `btc`; Kraken sends `BTC/USD` and the socket splits on `/`; `seedPricesFromCoins` upper-cases. Every component must call `selectPrice(symbol.toUpperCase())`. A casing mismatch renders _nothing_ — no error, no warning.
- **`bySymbol` values are replaced, never mutated in place.** Per-row re-rendering depends on object identity changing only for ticked symbols.
- **The socket's stop function is the effect cleanup.** `startKrakenTicker` returns it; it clears the flush interval, cancels any pending reconnect, and closes the socket. Don't drop it.
- **Reconnect backoff doubles 1s → 30s and resets on a healthy open.** Don't replace it with a fixed interval.

## Notes

`useAppDispatch` is exported but currently unused — every dispatch comes from the socket, not from a component. That's expected given the design; don't "fix" it by dispatching from components.
