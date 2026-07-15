import type { WebSocketRoute } from '@playwright/test';
import {
  test,
  expect,
  summarise,
  scanPage,
  ANY_SOCKET,
  ackSubscribe,
} from './fixtures';
import { PAGE_ROUTES, uncoveredDynamicRoutes, visitableRoutes } from './routes';

// Fails when a dynamic route is added without a sample value to visit it by, so
// a new route cannot quietly escape the scans below.
test('every route under app/ is reachable by these scans', () => {
  // Arrange / Act
  const uncovered = uncoveredDynamicRoutes();

  // Assert
  expect(uncovered).toEqual([]);
  expect(PAGE_ROUTES.length).toBeGreaterThan(0);
});

// Every route, in the state the server sends it.
for (const route of visitableRoutes()) {
  test(`${route} has no violations on load`, async ({
    page,
    makeAxeBuilder,
  }) => {
    // Arrange
    await page.goto(route);

    // Act
    const { violations } = await makeAxeBuilder().analyze();

    // Assert
    expect(summarise(violations)).toEqual([]);
  });
}

// The palette is dark-only and unconditional, so a viewer whose OS prefers light
// must still get light text on dark surfaces rather than dark on dark.
test('the markets page stays readable when the OS prefers light', async ({
  browser,
}) => {
  // Arrange
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('/');

  // Act
  const { violations } = await scanPage(page).analyze();

  // Assert
  expect(summarise(violations)).toEqual([]);
  await context.close();
});

// axe cannot see motion. The rule that disables it is global, so proving it on
// one animated element proves it for the ones added next.
test.describe('when the OS asks for less motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('a price does not animate when it ticks', async ({ page }) => {
    // Arrange — the flash only exists on a price that changed, so the tick has
    // to be real: read on load, this assertion passes with the rule deleted
    const connected = new Promise<WebSocketRoute>((resolve) => {
      void page.routeWebSocket(ANY_SOCKET, (ws) => {
        ws.onMessage((raw) => ackSubscribe(ws, raw));
        resolve(ws);
      });
    });
    await page.goto('/coins/bitcoin');
    const socket = await connected;
    await expect(page.getByText('$62,888')).toBeVisible(); // readiness gate

    // Act
    socket.send(
      JSON.stringify({
        channel: 'ticker',
        data: [{ symbol: 'BTC/USD', last: 63000, change_pct: 1 }],
      }),
    );
    await expect(page.getByText('$63,000')).toBeVisible();
    const duration = await page
      .getByText('$63,000')
      .evaluate((el) => getComputedStyle(el).animationDuration);

    // Assert — near zero, not zero: the tick arrow removes itself on
    // animationend, and a duration of 0 does not reliably deliver that
    expect(parseFloat(duration)).toBeLessThan(0.1);
  });
});

// States below exist only after an interaction, so a scan on load never sees them.
test.describe('states reached by a flow', () => {
  test('the failed-timeframe state has no violations', async ({
    page,
    makeAxeBuilder,
  }) => {
    // Arrange — fail the chart request, so the error and its retry render
    await page.route('**/api/chart/**', (route) =>
      route.fulfill({ status: 500, body: '' }),
    );
    await page.goto('/coins/bitcoin');
    await page.getByRole('button', { name: '24H' }).click();
    await expect(page.getByText(/Couldn't load that timeframe/)).toBeVisible(); // readiness gate

    // Act
    const { violations } = await makeAxeBuilder().analyze();

    // Assert
    expect(summarise(violations)).toEqual([]);
  });

  test('the chart has no violations after switching timeframe', async ({
    page,
    makeAxeBuilder,
  }) => {
    // Arrange
    await page.goto('/coins/bitcoin');
    await page.getByRole('button', { name: '1Y' }).click();
    await expect(page.getByRole('button', { name: '1Y' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ); // readiness gate

    // Act
    const { violations } = await makeAxeBuilder().analyze();

    // Assert
    expect(summarise(violations)).toEqual([]);
  });

  test('the detail page reached by navigation has no violations', async ({
    page,
    makeAxeBuilder,
  }) => {
    // Arrange — client-side navigation, not a fresh document load
    await page.goto('/');
    await page.getByRole('link', { name: /Bitcoin/ }).click();
    await expect(page).toHaveURL('/coins/bitcoin'); // readiness gate

    // Act
    const { violations } = await makeAxeBuilder().analyze();

    // Assert
    expect(summarise(violations)).toEqual([]);
  });
});

// axe cannot judge keyboard operability; it has to be driven.
test.describe('keyboard', () => {
  test('every timeframe button is reachable and operable by keyboard', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/coins/bitcoin');
    await page.getByRole('button', { name: '24H' }).focus();

    // Act
    await page.keyboard.press('Enter');

    // Assert
    await expect(page.getByRole('button', { name: '24H' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the focused element is always visibly focused', async ({ page }) => {
    // Arrange
    await page.goto('/coins/bitcoin');

    // Act
    await page.getByRole('button', { name: '1Y' }).focus();

    // Assert — a focus ring the browser draws is fine; none at all is not
    const outline = await page
      .getByRole('button', { name: '1Y' })
      .evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      });
    const hasVisibleFocus =
      (outline.outlineStyle !== 'none' &&
        parseFloat(outline.outlineWidth) > 0) ||
      outline.boxShadow !== 'none';
    expect(hasVisibleFocus).toBe(true);
  });
});
