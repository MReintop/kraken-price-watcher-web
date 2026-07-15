# Testing

## Arrange–Act–Assert

Every test — unit, integration **and e2e** — is written as **Arrange–Act–Assert**, with `// Arrange`, `// Act`, and `// Assert` comments marking the three sections.

- Collapse to a single `// Arrange / Act` when setup and the call under test are the same line.
- If a section is empty, say why rather than dropping the comment — e.g. `// Arrange (fetch stubbed above)`.
- One behaviour per test. If a test needs a second Act, it's two tests.
- Shared setup goes in a named helper (`renderWithStore`, `makeCoin`) so the Arrange section stays one line.

### Why it matters most in e2e

In a browser test the markers carry more weight than anywhere else, because nothing in the code distinguishes a setup click from the click under test — `page.click()` looks identical either way. The comments are the only thing that says which is which.

Two e2e-specific points:

- **An `expect` in Arrange is a readiness gate, not the claim.** Arrange is synchronous in a unit test, so this can't come up there; in a browser you must wait for the page to be ready, and Playwright's idiomatic wait _is_ an assertion. Mark it: `await expect(chart(page)).toBeVisible(); // readiness gate, not the claim`.
- **Generate tests in a loop; don't loop inside a test.** Looping act/assert cycles inside one test breaks "one Act per test", hides the repetition from the marker (one `// Act` comment, N executions), and dies on the first failure without naming which case broke. A `for` loop around `test()` keeps every test AAA-clean, names the failing case, and spreads across workers under `fullyParallel`. See the per-coin chart tests in `e2e/coin-detail.spec.ts`.

## File naming: `*.test.ts` vs `*.spec.ts`

Convention: **`*.test.ts` / `*.test.tsx` for Jest, `*.spec.ts` for Playwright.** It's a readability signal only — the two runners have different globals (`test`/`expect` imported from `@playwright/test` vs Jest's ambient ones), and the suffix tells you at a glance which world a file lives in. Playwright's own scaffolding generates `.spec.ts`, so this costs nothing to follow.

**The suffix does not decide the runner — the directory does.** Both tools match both patterns by default; the separation comes from `testPathIgnorePatterns: ['<rootDir>/e2e/']` in `jest.config.mjs` and `testDir: './e2e'` in `playwright.config.ts`. Playwright's `testMatch` deliberately accepts `*.test.ts` as well, so a mis-named file in `e2e/` still runs instead of being claimed by no runner at all and silently never executing.

## Which kind of test to write

Pick the cheapest test that can answer the question.

| Layer           | Tool               | Lives in                   | Covers                                                                                                                                                                                                                                                | Runs                    |
| --------------- | ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Unit**        | Jest               | `lib/`, `store/`           | Pure logic with real edge cases: chart geometry, tween math, data mapping, and the socket's tick coalescing + reconnect backoff (a fake `WebSocket` + fake timers). No renderer, no browser. Cheap enough to cover edges exhaustively — so do.        | on save, pre-commit, CI |
| **Integration** | Jest + RTL (jsdom) | `components/**/*.test.tsx` | Client components wired to their _real_ collaborators: real Redux store, real children, real dispatch. Stub only what leaves the process (`fetch`, `next/navigation`, `requestAnimationFrame`, the WebSocket). Most confidence should come from here. | on save, pre-commit, CI |
| **E2E**         | Playwright         | `e2e/*.spec.ts`            | What nothing cheaper can see: `async` Server Components, routing, SSG/ISR pages, hydration, real route handlers.                                                                                                                                      | pre-push, CI            |

Don't reach for E2E when an integration test answers the same question — and don't reach for a unit test when the risk is in the wiring rather than the logic.

Snapshot tests are not used here. They report _that_ something changed, never whether the change was wrong, and decay into reflexive `-u`.

## Redux: test the slice through the components that use it

Per [the Redux testing guide](https://redux.js.org/usage/writing-tests): _"the end-user does not know, and does not care whether Redux is used within the application at all. As such, the Redux code can be treated as an implementation detail."_

- **Do not** write isolated unit tests for reducers, selectors, action creators, or thunks. Render a `<Provider>` with a **real** store, dispatch **real** actions, and assert the **UI** updated. Tests then survive a refactor of the state shape (or a move to RTK Query, or dropping Redux) instead of failing falsely.
- **Never** mock selectors or the react-redux hooks. Mock at the network boundary (`fetch`) or the module boundary (`@/store/krakenSocket`) instead.
- **The exception the guide allows:** a reducer or selector with _genuinely complex_ logic may be unit-tested directly. Ordinary merge/lookup logic is not complex — cover it through a component.

Worked examples: `CoinPriceHeader.test.tsx` covers `tickersApplied`, `socketStatusChanged`, `selectPrice`, and `selectLive` by dispatching into a real store and asserting the DOM. `StoreProvider.test.tsx` covers `seedPricesFromCoins` the same way.

## Server components and the mocking boundary

The coin/candle fetches run in **Node** (RSC and route handlers), so they never pass through the browser and **Playwright's `page.route()` cannot intercept them**. Mocking for server-rendered pages therefore happens _upstream of Node_: `COINGECKO_BASE_URL` and `KRAKEN_BASE_URL` point at the stub in `e2e/stub/upstreams.mjs`, and the app is **built** against it (the coin pages are SSG — the stub must be up before `next build` or the fixtures never reach the HTML).

`NEXT_PUBLIC_KRAKEN_WS_URL` is redirected in the same build, for a different reason: the socket _does_ run in the browser, but relying on each spec to intercept it means one forgotten call sends CI to the live exchange. Inlining a stub URL at build time makes that unreachable rather than merely discouraged — `e2e/fixtures.ts` then intercepts every socket automatically, and a spec that wants to drive ticks registers its own route on top.

`page.route()` is still the right tool for genuinely client-side requests, such as `/api/chart/*` — see the superseded-response test in `e2e/coin-detail.spec.ts`.

## Coverage — and its one blind spot

`npm run test:coverage` measures **only what Jest can see**. Async Server Components are excluded from `collectCoverageFrom` in `jest.config.mjs`, because React Testing Library cannot render them at all — left in, they read 0% forever and teach everyone to ignore the number.

Currently excluded, all covered in `e2e/` instead:

| Excluded                                                                       | Why                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `app/layout.tsx`, `app/coins/**`                                               | `async` Server Components                                         |
| `components/markets/Markets.tsx`, `components/marketSummary/MarketSummary.tsx` | `async` Server Components                                         |
| `app/page.tsx`                                                                 | sync, but renders async children — so it cannot render either     |
| `app/api/**`                                                                   | route handlers, not components; exercised through the real server |

**Adding an `async` Server Component, a page that renders one, or a route handler means adding a `!` line to `collectCoverageFrom`.** The criterion is **async**, not "server" — sync server components (the skeletons) render fine under RTL and stay in.

With that list maintained, every remaining 0% is a genuine gap worth acting on. Playwright reports no coverage number at all; its signal is pass/fail.

## Running them

```bash
npm test              # jest: unit + integration, ~2s
npm run test:coverage # + coverage → open coverage/lcov-report/index.html
npm run test:e2e      # playwright: builds against the stub, then runs (~40s)
npm run test:e2e:ui   # playwright interactive mode
```

`pre-commit` runs prettier + eslint on staged files; `pre-push` runs both suites.
