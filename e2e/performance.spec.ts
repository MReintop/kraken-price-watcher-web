import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect, ANY_SOCKET, ackSubscribe } from './fixtures';

// Ratcheted a few percent above the current build: raise one only with a reason.
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

const tickFrame = (symbol: string, last: number) =>
  JSON.stringify({
    channel: 'ticker',
    data: [{ symbol, last, change_pct: 1.5 }],
  });

// Arrange helper: mock the socket, hand back a sender, and wait for a live feed.
// A first price is what makes it live — an acknowledgement only promises one —
// so sending one doubles as the gate that the socket is attached before a test
// starts pushing. Sent at the seeded price, so it moves nothing on screen.
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
  const socket = await connected;
  socket.send(tickFrame('BTC/USD', 62888));
  await expect(page.getByText('Live')).toBeVisible();
  return socket;
}

test.describe('under a burst of ticks', () => {
  test('settles on the last price it was sent', async ({ page }) => {
    // Arrange
    const socket = await openWithMockedSocket(page);

    // Act — coalescing may drop intermediate ticks, but never the newest
    for (let i = 0; i < 200; i++) socket.send(tickFrame('BTC/USD', 70000 + i));

    // Assert
    await expect(page.getByText('$70,199')).toBeVisible({ timeout: 5000 });
  });

  test('stays interactive while ticks are arriving', async ({ page }) => {
    // Arrange
    const socket = await openWithMockedSocket(page);
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

    // Act
    for (let i = 0; i < 100; i++) socket.send(tickFrame('ETH/USD', 1900 + i));
    await page.waitForTimeout(500);

    // Assert — the seeded bitcoin price is untouched
    await expect(page.getByText('$62,888')).toBeVisible();
  });
});
