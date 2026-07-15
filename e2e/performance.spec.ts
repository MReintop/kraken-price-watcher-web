import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect, ANY_SOCKET, ackSubscribe } from './fixtures';

// ---------------------------------------------------------------------------
// Payload budgets
//
// Bytes, not milliseconds. Wall-clock numbers depend on the machine and what
// else it is doing, so a threshold loose enough not to flake is loose enough to
// catch nothing. Bytes are deterministic, and bytes are what regress: one stray
// import of a heavy library into a client component is invisible until measured.
//
// Ratcheted just above the current build. Raise them deliberately and only with
// a reason — a number that only ever goes up is not a budget.
// ---------------------------------------------------------------------------
const BUDGET_KB = {
  '/': { js: 170, total: 228 },
  '/coins/bitcoin': { js: 172, total: 228 },
};

const transferredKb = (page: Page) =>
  page.evaluate(() => {
    const resources = performance.getEntriesByType(
      'resource',
    ) as PerformanceResourceTiming[];
    const kb = (bytes: number) => Math.round(bytes / 1024);
    return {
      js: kb(
        resources
          .filter((entry) => entry.name.endsWith('.js'))
          .reduce((total, entry) => total + entry.transferSize, 0),
      ),
      total: kb(
        resources.reduce((total, entry) => total + entry.transferSize, 0),
      ),
    };
  });

for (const [route, budget] of Object.entries(BUDGET_KB)) {
  test(`${route} stays within its payload budget`, async ({ page }) => {
    // Arrange
    await page.goto(route, { waitUntil: 'load' });

    // Act
    const shipped = await transferredKb(page);

    // Assert — total as well as js: css, fonts and images are weight too
    expect(shipped.js, `${route} shipped ${shipped.js}KB of js`).toBeLessThan(
      budget.js,
    );
    expect(
      shipped.total,
      `${route} shipped ${shipped.total}KB in total`,
    ).toBeLessThan(budget.total);
  });
}

test('the markets list is server-rendered, costing no client request for prices', async ({
  page,
}) => {
  // Arrange
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    if (/coingecko|kraken|\/api\//.test(request.url()))
      apiCalls.push(request.url());
  });

  // Act
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.getByText('$62,888')).toBeVisible();

  // Assert — prices arrive in the HTML; a client round-trip would mean the
  // server component's work was wasted
  expect(apiCalls).toEqual([]);
});

// ---------------------------------------------------------------------------
// Behaviour under load
//
// Correctness while ticks pour in, not timing. Main-thread jank is not
// measurable here: with the socket's coalescing removed entirely, 500 ticks
// still produce no long task, so any such assertion would pass either way. That
// the coalescing works is asserted in store/krakenSocket.test.ts, where the
// dispatches can actually be counted.
//
// routeWebSocket takes over the Kraken socket, so these ticks are ours: same
// count, same values, every run. This route is registered after the fixture's
// default one and takes precedence over it.
// ---------------------------------------------------------------------------
const tickFrame = (symbol: string, last: number) =>
  JSON.stringify({
    channel: 'ticker',
    data: [{ symbol, last, change_pct: 1.5 }],
  });

// Arrange helper: mock the socket and hand back a sender.
async function openWithMockedSocket(page: Page) {
  let resolveSocket: (route: WebSocketRoute) => void;
  const connected = new Promise<WebSocketRoute>((resolve) => {
    resolveSocket = resolve;
  });

  await page.routeWebSocket(ANY_SOCKET, (ws) => {
    // Nothing is proxied to the real Kraken; accept the subscribe as Kraken
    // would, or the app never leaves "Connecting…".
    ws.onMessage((raw) => ackSubscribe(ws, raw));
    resolveSocket(ws);
  });

  await page.goto('/coins/bitcoin');
  return connected;
}

test.describe('under a burst of ticks', () => {
  test('settles on the last price it was sent', async ({ page }) => {
    // Arrange
    const socket = await openWithMockedSocket(page);
    await expect(page.getByText('Live')).toBeVisible(); // readiness gate

    // Act — coalescing may drop intermediate ticks, but never the newest
    for (let i = 0; i < 200; i++) socket.send(tickFrame('BTC/USD', 70000 + i));

    // Assert
    await expect(page.getByText('$70,199')).toBeVisible({ timeout: 5000 });
  });

  test('stays interactive while ticks are arriving', async ({ page }) => {
    // Arrange
    const socket = await openWithMockedSocket(page);
    await expect(page.getByText('Live')).toBeVisible(); // readiness gate
    const flooding = setInterval(
      () => socket.send(tickFrame('BTC/USD', 60000 + Math.random() * 1000)),
      5,
    );

    // Act — a click has to win against a socket pushing 200 ticks a second
    await page.getByRole('button', { name: '24H' }).click();

    // Assert
    await expect(page.getByRole('button', { name: '24H' })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 5000 },
    );
    clearInterval(flooding);
  });

  test('ignores ticks for symbols this page does not show', async ({
    page,
  }) => {
    // Arrange
    const socket = await openWithMockedSocket(page);
    await expect(page.getByText('Live')).toBeVisible(); // readiness gate

    // Act
    for (let i = 0; i < 100; i++) socket.send(tickFrame('ETH/USD', 1900 + i));
    await page.waitForTimeout(500);

    // Assert — the seeded bitcoin price is untouched
    await expect(page.getByText('$62,888')).toBeVisible();
  });
});
