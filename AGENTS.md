This is **kraken-price-watcher-web** — a React + Next.js application.
Its sibling **kraken-price-watcher** is the React Native (Expo) one; don't apply its native conventions here.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Guides — read the relevant one before you touch that area

These are not optional background. Each documents decisions that are invisible in the code and that fail silently when broken.

- **[docs/store.md](docs/store.md)** — read before touching `store/`, `StoreProvider`, or anything reading prices. Covers the server-state vs client-state split, why the store is a per-request factory, the tick coalescing, and the invariants (the UPPERCASE symbol contract renders _nothing_ when broken — no error).
- **[docs/testing.md](docs/testing.md)** — read before writing or changing a test. Covers the mandatory Arrange–Act–Assert format, which of unit/integration/e2e to reach for, why Redux slices are tested through components rather than in isolation, and why `page.route()` cannot mock a server component's fetch.

# Conventions

- **Formatting is prettier's job, correctness is eslint's.** Don't hand-format, and don't add stylistic eslint rules — `eslint-config-prettier` turns them off on purpose.
- **Hooks run automatically:** `pre-commit` runs prettier + eslint over staged files only; `pre-push` runs the whole test suite (jest + playwright). Don't `--no-verify` around a failure; fix it.

## Props get a named interface

A component taking props declares an `interface` named after it — `CoinChartProps`, `TimeframeSelectorProps` — even for a single prop. Not an inline object literal after the destructure, and **never a bare `Props`**: every file would declare a different type under the same name, so the name says nothing at a call site and greps for it are useless.

## Comments: last resort, local, short

Write code that doesn't need explaining. Reach for a better name before reaching for a comment — if a comment says _what_ something is, that's a naming bug.

When a comment is genuinely necessary:

- **Local only.** It describes the file it sits in. No pointers to other files, other apps this was ported from, past bugs, previous approaches, or why an alternative was rejected. That context belongs in `docs/`, the PR, or the commit message — it goes stale in code and it's noise to the next reader.
- **Explain, don't narrate.** Worth writing: a constraint the code can't express, a non-obvious consequence, an external data format, a deliberate trade-off. Not worth writing: restating the next line, section banners, architecture tours, or notes to the reviewer.
- **Short.** One line, two at most. If it needs a paragraph, either the code needs better names or the reasoning belongs in `docs/`.

The only mandated comments are the `// Arrange` / `// Act` / `// Assert` markers in tests — see [docs/testing.md](docs/testing.md).

## Adding an `async` Server Component? Exclude it from Jest coverage.

**Whenever you add an `async` Server Component, a page that renders one, or a route handler, add a matching `!` line to `collectCoverageFrom` in `jest.config.mjs`** — and cover it in `e2e/` instead.

React Testing Library cannot render an async Server Component, so Jest can never reach it. Left in the list it reads 0% forever, drags the total down, and trains everyone to ignore the number — which is how a _real_ 0% slips past. The list is an allowlist of "what Jest can actually see", and it only stays meaningful if it's maintained.

The test is **async**, not "server": sync server components (the skeletons, `app/contacts/page.tsx`) render fine under RTL and stay in. Full reasoning in [docs/testing.md](docs/testing.md).

```bash
npm test              # jest: unit + integration, ~2s
npm run test:coverage # + coverage report
npm run test:e2e      # playwright: builds against the stub, then runs (~40s)
npm run test:e2e:ui   # playwright interactive mode
npm run lint          # eslint
```
