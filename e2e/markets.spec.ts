import { test, expect, ANY_SOCKET } from './fixtures';

// The markets list is the screen people leave open, so what it says when the
// feed is not working is worth as much as what it says when it is.
test.describe('Markets (feed state)', () => {
  test('says it is connecting while Kraken has acknowledged nothing', async ({
    page,
  }) => {
    // Arrange — a transport that opens and then says nothing at all
    await page.routeWebSocket(ANY_SOCKET, (ws) => {
      ws.onMessage(() => {});
    });

    // Act
    await page.goto('/');

    // Assert — an open socket is not a feed, and the list must not look normal
    await expect(page.getByRole('status')).toHaveText('Connecting…');
  });

  test('names the one symbol Kraken refused, and leaves the rest alone', async ({
    page,
  }) => {
    // Arrange — every symbol accepted except ETH/USD
    await page.routeWebSocket(ANY_SOCKET, (ws) => {
      ws.onMessage((raw) => {
        const msg = JSON.parse(String(raw));
        if (msg.method !== 'subscribe') return;
        for (const symbol of msg.params?.symbol ?? []) {
          ws.send(
            JSON.stringify({
              method: 'subscribe',
              success: symbol !== 'ETH/USD',
              result: { channel: 'ticker', symbol },
            }),
          );
        }
      });
    });

    // Act
    await page.goto('/');

    // Assert — the feed is healthy, so the banner stays quiet; one instrument
    // on it is not, and only that row says so
    await expect(page.getByRole('link', { name: /Ethereum/ })).toContainText(
      'Not available',
    );
    await expect(page.getByRole('link', { name: /Bitcoin/ })).not.toContainText(
      'Not available',
    );
    await expect(page.getByRole('status')).toBeEmpty();
  });
});

test.describe('Markets (server-rendered)', () => {
  test('lists every coin from the server fetch', async ({ page }) => {
    // Arrange / Act
    await page.goto('/');

    // Assert
    await expect(page.getByRole('link', { name: /Bitcoin/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ethereum/ })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(8);
  });

  test('renders the summary the server computed from the coin list', async ({
    page,
  }) => {
    // Arrange / Act
    await page.goto('/');

    // Assert — 8 coins; the stub's 24h changes sum to 8.3, so the avg is +1.04%
    await expect(page.getByText('8 coins')).toBeVisible();
    await expect(page.getByText(/Avg 24h ▲ 1\.04%/)).toBeVisible();
  });

  test('serves prices in the HTML itself, before any client JS runs', async ({
    browser,
  }) => {
    // Arrange — a context with JS disabled sees only what the server sent
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    // Act
    await page.goto('/');

    // Assert — proves the RSC path, not a client-side fetch, produced this
    await expect(page.getByText('$62,888')).toBeVisible();
    await context.close();
  });
});

test.describe('Not found', () => {
  test('answers a made-up coin with our own page, not the framework default', async ({
    page,
  }) => {
    // Act — a reviewer editing the URL bar is the whole reason this exists
    const response = await page.goto('/coins/notacoin');

    // Assert
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'Not found' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Back to markets' }),
    ).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('a coin links through to its detail page', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await page.getByRole('link', { name: /Bitcoin/ }).click();

    // Assert
    await expect(page).toHaveURL('/coins/bitcoin');
    await expect(page.getByRole('heading', { name: /Bitcoin/ })).toBeVisible();
  });
});
