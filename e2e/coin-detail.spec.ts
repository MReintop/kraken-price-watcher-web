import { test, expect, ANY_SOCKET } from './fixtures';

const chart = (page: import('@playwright/test').Page) =>
  page.locator('svg').first();

const COIN_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'cardano',
  'ripple',
  'dogecoin',
  'polkadot',
  'chainlink',
];

// Data comes from the stub, which never rate-limits: these prove the page renders
// a chart given good data, not that the live upstream supplies it.
test.describe('Coin detail — chart renders on first load', () => {
  for (const id of COIN_IDS) {
    test(`${id} shows a chart straight from the build`, async ({ page }) => {
      // Arrange / Act
      await page.goto(`/coins/${id}`);

      // Assert
      await expect(chart(page)).toBeVisible();
      await expect(page.getByText('Chart unavailable')).toHaveCount(0);
    });
  }
});

test.describe('Coin detail', () => {
  test('switching timeframe fetches new candles through the real route handler', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/coins/bitcoin');
    await expect(chart(page)).toBeVisible(); // readiness gate, not the claim

    // Act
    const response = page.waitForResponse(
      (res) =>
        res.url().includes('/api/chart/bitcoin') &&
        res.url().includes('days=1'),
    );
    await page.getByRole('button', { name: '24H' }).click();
    await response;

    // Assert
    await expect(page.getByRole('button', { name: '24H' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(chart(page)).toBeVisible();
  });

  test('a superseded timeframe response does not overwrite the newer one', async ({
    page,
  }) => {
    // Arrange — hold the 24H response back until after 1Y has landed
    await page.route('**/api/chart/**days=1', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto('/coins/bitcoin');
    await expect(chart(page)).toBeVisible(); // readiness gate, not the claim

    // Act — click the slow one, then immediately the fast one
    await page.getByRole('button', { name: '24H' }).click();
    await page.getByRole('button', { name: '1Y' }).click();
    await page.waitForTimeout(2500); // outlast the delayed 24H response

    // Assert — 1Y is the last click, so 1Y must win
    await expect(page.getByRole('button', { name: '1Y' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(chart(page)).toBeVisible();
  });

  test('reports no console errors while rendering and hydrating', async ({
    page,
  }) => {
    // Arrange
    const errors: string[] = [];
    page.on(
      'console',
      (msg) => msg.type() === 'error' && errors.push(msg.text()),
    );

    // Act
    await page.goto('/coins/bitcoin');
    await expect(chart(page)).toBeVisible();

    // Assert — catches hydration mismatches, which jsdom cannot surface
    expect(errors).toEqual([]);
  });

  test('rejects a timeframe it has no interval for', async ({ request }) => {
    // Act — the selector cannot ask for 7d, but a hand-typed URL can
    const response = await request.get('/api/chart/bitcoin?days=7');

    // Assert — 400, not 30-day candles wearing a 7d label
    expect(response.status()).toBe(400);
  });

  test('answers 404 for a coin it does not track', async ({ request }) => {
    // Act
    const response = await request.get('/api/chart/notacoin');

    // Assert — 404, not the 500 that blames us for a URL the caller made up
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  test('answers 502 when the exchange is the one that failed', async ({
    request,
  }) => {
    // Act — the stub refuses this pair and interval, as Kraken does: HTTP 200
    // with a populated error array
    const response = await request.get('/api/chart/polkadot?days=1');

    // Assert — a 500 would say we broke, and tell a caller nothing about
    // whether retrying is worth its time
    expect(response.status()).toBe(502);
  });
});

test.describe('feed health', () => {
  test('does not claim to be live until the subscription is accepted', async ({
    page,
  }) => {
    // Arrange — a socket that opens and then says nothing. This is what a
    // half-open connection, or a rejected subscription, looks like from here.
    await page.routeWebSocket(ANY_SOCKET, (ws) => {
      ws.onMessage(() => {});
    });

    // Act
    await page.goto('/coins/bitcoin');
    await expect(chart(page)).toBeVisible();

    // Assert — the transport is open, and that is not the same as a feed
    await expect(page.getByText('Connecting…')).toBeVisible();
    await expect(page.getByText('Live')).toBeHidden();
  });
});

// Every test above runs in the default en-US, where a formatter left on the
// runtime locale renders identically on both sides and the bug is invisible.
test.describe('under a non-en-US locale', () => {
  test.use({ locale: 'de-DE' });

  test('formats prices in the pinned locale, not the browser one', async ({
    page,
  }) => {
    // Act
    await page.goto('/coins/bitcoin');
    await expect(chart(page)).toBeVisible();

    // Assert — on the runtime locale this hydrates to "$62.888,00", replacing
    // the text the server sent. Console errors cannot see it: a production
    // React patches a text mismatch silently.
    await expect(page.getByText('$62,888.0', { exact: true })).toBeVisible();
  });
});
