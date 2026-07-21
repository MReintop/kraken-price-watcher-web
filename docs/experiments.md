# Experiments

One A/B experiment, assigned and logged **on the server**. The variant is in the
first byte the browser receives, so there is no flicker and no client round-trip
to decide what to render.

## The flow

```
proxy.ts                                matcher: ['/'] only
  └─ attachUnitId(request)              lib/experiments/requestUnitId.ts
       ├─ cookie kpw_uid, if it is a UUID we issued
       ├─ else crypto.randomUUID() → set on the RESPONSE cookie (1 year)
       └─ EITHER WAY: overwrite the x-kpw-uid REQUEST header

components/markets/Markets.tsx (async server component)
  └─ await serverVariant(CHANGE_PILL_STYLE)    lib/experiments/server.ts
       ├─ getUnitId()      x-kpw-uid header ?? 'anonymous'
       ├─ assignVariant()  FNV-1a(`${unitId}:${key}`) → bucket → variant
       └─ logExposure()    once per unitId per experiment → ExposureSink
            └─ passed down as a prop → CoinPriceRow (client)
                 └─ priceDirection / directionGlyph / formatChangePercent
```

## Decisions that are invisible in the code

**A cookie set on the response is not on the request that set it.** A first-time
visitor's render would find no unit id at all and fall through to `anonymous`.
So the id also rides an `x-kpw-uid` **request** header, which covers that one
request; the cookie takes over from the second one on. Delete the header bridge
and nothing throws — every new visitor just silently shares one bucket.

**The header is written on every matched request, never merely added.** It is an
internal name, so an inbound `x-kpw-uid` is a caller choosing their own arm. The
proxy overwrites it with a validated cookie or a fresh id, and `getUnitId()`
reads _only_ the header — the one form of this value a client cannot pick. A
cookie that is not a UUID is discarded rather than trusted.

**The matcher is `['/']`.** Every path it covers pays a proxy hop and is handed a
tracking cookie, and `/` is the only route that renders a variant. Widen it when
that stops being true, not before.

**`index.ts` names its exports, and does not export `server.ts` or
`requestUnitId.ts`.** They import `next/headers` and `next/server`. Re-exporting
them from the barrel would pull request-scoped server APIs into any client
component that imports a type from `@/lib/experiments`.

**The experiment key is versioned (`change_pill_style_v1`).** The key is the hash
salt, so changing the variants, their order, or the bucket maths reassigns
everyone already in the test — mid-experiment, and invisibly. Golden fixtures in
`registry.test.ts` fail when that happens, and the fix is a `_v2` key rather than
a new expectation.

**`Experiment` keeps its variants as a literal tuple.** `VariantOf<typeof
CHANGE_PILL_STYLE>` is `'control' | 'arrow'`, so a typo'd `'arow'` is a compile
error instead of a silent control, and the tuple's non-empty shape is why
`assignVariant` cannot return `undefined` while claiming a string.

**Assignment and exposure happen in the same place.** The server decides, so the
server is the honest place to record that a user saw a variant. Logging the
exposure client-side would count a different population — whoever ran the JS.

**The arrow is decorative and rendered `aria-hidden`.** The sign in the text
already says which way the market went, so a glyph inside the label would make
the treatment a change to what a screen reader announces as well as to what the
page looks like — two variables, one experiment. Control and treatment have the
same accessible name.

**Flat is its own direction.** `priceDirection` returns `up | down | flat`, and a
market that did not move gets the neutral pill, no glyph, and an unsigned
`0.00%`. This experiment is about how direction reads, so `▲ +0.00%` would be
measuring a claim the data never made.

## The cost: `/` is no longer static

`getUnitId()` calls `headers()`, which opts the whole route into dynamic
rendering. Measured against the commit before the experiment landed:

|        | `/`                                                 |
| ------ | --------------------------------------------------- |
| before | `○ Static` — prerendered, revalidate 30s, expire 1y |
| after  | `ƒ Dynamic` — server-rendered on demand             |

This is a real trade, not an accident: a per-user variant needs per-user
rendering. Two consequences worth stating plainly.

The coin list is now fetched per request rather than at build, so the argument
that `getCoins()`'s `Promise.all` is safe _because it runs at build time, where
an outage fails the build loudly instead of blanking a screen_ no longer holds
for this route. It still holds for `/coins/[id]`, which is SSG.

**Partial Prerendering is the way back** — a static shell with the pill as a
dynamic hole — and is the next planned step here. Until then, `/` pays a server
render per request for one string.

## What this is not

- **Even splits only.** The bucket's resolution is spent on `% variants.length`,
  so a 5%/95% rollout needs a different `assignVariant`.
- **Exposure dedupe is per process and unbounded.** A second instance logs the
  same user again, and the set grows with the audience.
- **`consoleSink` is the only sink.** Nothing is aggregated, stored or analysed.
- **`'anonymous'` is a silent bucket.** Any request that reaches the app without
  the proxy having run shares one unit id, one variant, and one exposure.

## Testing

`server.ts` and `requestUnitId.ts` are excluded from Jest coverage — one needs a
live `headers()` store, the other a `NextRequest`. They are asserted end-to-end
in `e2e/experiments.spec.ts`, which reads the HTML **with JavaScript disabled**:
that is what proves the variant was server-rendered rather than patched in on
hydration.

Three things there are easy to get wrong, and each was verified by breaking it:

- **The assertion is scoped to a row and exact.** `MarketSummary` renders an `▲`
  of its own, so asserting on the glyph alone passes with the pill fully broken.
- **The first-visit test retries until the minted id lands opposite the
  `'anonymous'` fallback.** Otherwise a broken header bridge renders the fallback
  arm, agrees half the time with the id it ignored, and proves nothing.
- **Unit ids in the spec are UUID-shaped**, because the proxy discards a cookie
  that is not one.
