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
app/(markets)/layout.tsx (server component)
  └─ await getCoins()                    ← server fetch, once per request
      (the root layout stays static: a 404 should not wait on an exchange)
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
- **Status starts `connecting`; an open socket cannot promote it.** Kraken answers a subscribe **once per symbol**, naming the symbol, and the feed is not live until every one has been answered for — one accepted symbol speaking for eight is how a dead instrument keeps a green badge. A ticker frame promotes too: it is evidence, where an open transport is not. The status is `connecting | live | stale | offline` rather than a boolean because `stale` — connected, believed healthy, silently frozen — is the state that actually hurts.
- **A refused symbol is named, not averaged away.** `unavailable` carries the symbols Kraken rejected or never answered for, so a row can say it is not receiving while the socket is genuinely live for everything else. A single global flag cannot answer "which price is frozen", which is the only useful form of the question.
- **The handshake has a deadline, and silence is an answer.** A symbol unanswered after `HANDSHAKE_MS` is treated as refused. Without it, one missing reply parks the whole feed at "Connecting…" forever, with prices on screen and no explanation.
- **One socket, not one per row.** `startKrakenTicker` subscribes to every symbol on a single connection.
- **Ticks are coalesced.** Incoming ticks land in a `Map` keyed by symbol (latest wins) and flush as a _single_ `tickersApplied` dispatch every 250ms. Kraken pushes far faster than any UI needs; this bounds re-render rate regardless of market activity.
- **Selectors are per-symbol.** `selectPrice(symbol)` returns that symbol's last price — a number, so a tick changes what exactly one row reads and only that row re-renders. This is why the list stays cheap with a live feed.

## Invariants — break these and things fail silently

- **Symbols are UPPERCASE in the store.** CoinGecko returns `btc`; Kraken sends `BTC/USD` and the socket splits on `/`; `seedPricesFromCoins` upper-cases. Every component must call `selectPrice(symbol.toUpperCase())`. A casing mismatch renders _nothing_ — no error, no warning.
- **The 24h change is not in the store, and must not be put there.** It is CoinGecko's cross-exchange figure; the socket carries Kraken's own. Same window, different market. Beside a Kraken price in one record, something will eventually overwrite it with Kraken's and the label will silently start meaning another market — so it travels to the row as a prop from the server instead, and `bySymbol` holds nothing but the price.
- **Price precision is not in the store either, and travels as a prop.** `bySymbol` holds the raw number Kraken sent. How many decimals to render it at is a fact about the _pair_ — `pair_decimals` from `AssetPairs` — and no amount of looking at one price reveals it. Deciding by magnitude is what rounded a real BTC/USD trade at 62,888.4 to `$62,888`: that market moves in tenths of a dollar, so the UI was quietly coarser than the exchange and several valid ticks changed nothing on screen. Counting the decimals of the value that arrived is no better — the same market would render to a different precision on every tick that happened to land on a round number.
- **The socket's stop function is the effect cleanup.** `startKrakenTicker` returns it; it clears the flush interval, the staleness watchdog and any pending reconnect, and closes the socket. Don't drop it.
- **Reconnect backoff doubles 1s → 30s and resets only on an _acknowledged_ connection.** Not on open: a server that accepts a socket and immediately drops it would otherwise reset the backoff every cycle and spin at one reconnect per second.
- **Handlers close over their own socket and a connection generation.** A frame or a close from a connection that has already been replaced is ignored, and the tick buffer is cleared on close — a price buffered before a drop must never flush afterwards as if it were current.
- **Any frame refreshes the watchdog, heartbeats included, and it is armed when the socket opens.** Kraken heartbeats roughly every second when the market is quiet, so silence past `STALE_AFTER_MS` means the connection is dead in a way it hasn't told us about — while a market with no trades is merely quiet, and quiet is not broken. Arming on the first frame instead would mean a socket that opens and says nothing is never watched at all: the exact case worth watching.
- **Going stale closes the socket.** Reporting a frozen feed and then sitting on it helps no one; the close routes it through the normal reconnect, backoff and all.

## Where this differs from the React Native app, and why

The sibling (`kraken-price-watcher`) is the same product on another surface. The
differences below are deliberate on both sides — its `docs/store.md` argues the
same list from its end. Neither app is the other one, behind.

**A factory here, a singleton there.** `makeStore()` exists because a
module-level store on a server is shared between requests, and one visitor's
prices would render into another's page. RN has no server and no requests: one
store per process is the lifetime it wants, and a factory there would be
cargo-culting a fix for a problem it cannot have.

**`bySymbol` here, `items[]` there.** Both get per-row re-render isolation; only
the route differs. This app keys by symbol so a selector returns one row's
price. RN gets the same property from `selectCoinById` plus Immer preserving the
identity of coins a tick didn't touch — and its render-count test would fail if
that stopped being true. Normalising there would buy nothing measurable.

**RN pauses on `background`; this app doesn't.** A phone app is backgrounded for
hours, so RN subscribes to `AppState` and stops reconnecting. A hidden tab is
not the same thing, and browsers already throttle timers in one. The Page
Visibility API is the analogue if this ever needs it — it doesn't yet.

**The socket starts in an effect here, in middleware there.** RN starts it on
`fetchCoins.pending` so a CoinGecko outage cannot hold Kraken's prices hostage.
This app has no such coupling to break: the symbols come from the server render
that already happened, and `StoreProvider` freezes them at mount so the effect
never re-runs. Same guarantee, reached by the shape each platform already had.

Worth naming: RN had jittered reconnects before this app did, and this app's own
`lib/http.ts` had been arguing for jitter next door the whole time. A fix landing
in one and not the other is drift, not divergence — the list above is the second
kind, and it is the only kind that should survive review.

## Notes

`useAppDispatch` is exported but currently unused — every dispatch comes from the socket, not from a component. That's expected given the design; don't "fix" it by dispatching from components.
