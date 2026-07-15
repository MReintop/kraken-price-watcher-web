# The store

Redux Toolkit, deliberately small. **The store holds only what cannot live on the server**: live WebSocket ticks and socket status. The coin list, market summary and initial candles are all server-fetched by React Server Components and passed down as props — none of that is in Redux, and none of it should be.

That split is the whole design. If you find yourself adding server data to the store, the answer is almost always a server component instead.

## The pieces

```
store/store.ts         makeStore() — a FACTORY, never a module singleton
store/pricesSlice.ts   the only slice: bySymbol (last price) + status, plus seedPricesFromCoins()
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
- **Status starts `connecting`; an open socket cannot promote it.** Only an acknowledged subscription, or an actual ticker frame, may — both are evidence the feed works, where an open transport is not: Kraken can accept the connection and reject the subscription, and a screen reading "Live" over prices nobody is sending is worse than one admitting it is lost. The status is `connecting | live | stale | offline` rather than a boolean because `stale` — connected, believed healthy, silently frozen — is the state that actually hurts, and a boolean cannot hold it.
- **One socket, not one per row.** `startKrakenTicker` subscribes to every symbol on a single connection.
- **Ticks are coalesced.** Incoming ticks land in a `Map` keyed by symbol (latest wins) and flush as a _single_ `tickersApplied` dispatch every 250ms. Kraken pushes far faster than any UI needs; this bounds re-render rate regardless of market activity.
- **Selectors are per-symbol.** `selectPrice(symbol)` returns that symbol's last price — a number, so a tick changes what exactly one row reads and only that row re-renders. This is why the list stays cheap with a live feed.

## Invariants — break these and things fail silently

- **Symbols are UPPERCASE in the store.** CoinGecko returns `btc`; Kraken sends `BTC/USD` and the socket splits on `/`; `seedPricesFromCoins` upper-cases. Every component must call `selectPrice(symbol.toUpperCase())`. A casing mismatch renders _nothing_ — no error, no warning.
- **The 24h change is not in the store, and must not be put there.** It is CoinGecko's cross-exchange figure; the socket carries Kraken's own. Same window, different market. Beside a Kraken price in one record, something will eventually overwrite it with Kraken's and the label will silently start meaning another market — so it travels to the row as a prop from the server instead, and `bySymbol` holds nothing but the price.
- **The socket's stop function is the effect cleanup.** `startKrakenTicker` returns it; it clears the flush interval, the staleness watchdog and any pending reconnect, and closes the socket. Don't drop it.
- **Reconnect backoff doubles 1s → 30s and resets only on an _acknowledged_ connection.** Not on open: a server that accepts a socket and immediately drops it would otherwise reset the backoff every cycle and spin at one reconnect per second.
- **Handlers close over their own socket and a connection generation.** A frame or a close from a connection that has already been replaced is ignored, and the tick buffer is cleared on close — a price buffered before a drop must never flush afterwards as if it were current.
- **Any frame refreshes the watchdog, heartbeats included.** Kraken heartbeats roughly every second when the market is quiet, so silence past `STALE_AFTER_MS` means the connection is dead in a way it hasn't told us about. Quiet is not the same as broken.

## Notes

`useAppDispatch` is exported but currently unused — every dispatch comes from the socket, not from a component. That's expected given the design; don't "fix" it by dispatching from components.
