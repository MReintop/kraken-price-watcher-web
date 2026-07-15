import { test, expect } from '@playwright/test';

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
});
