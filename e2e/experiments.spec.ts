import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  assignVariant,
  CHANGE_PILL_STYLE,
  type ChangePillVariant,
} from '../lib/experiments';
import { UID_COOKIE } from '../lib/experiments/unit';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// UUID-shaped, because the proxy discards a cookie that is not one: an id it
// never issued must not get to pick its own bucket.
const uuidFor = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Derived, not hardcoded: which id lands in `arrow` is the hash's business, and
// this file is about what the server does with the answer.
const unitIdFor = (variant: ChangePillVariant): string => {
  for (let i = 0; i < 1000; i++) {
    const unitId = uuidFor(i);
    if (assignVariant(unitId, CHANGE_PILL_STYLE) === variant) return unitId;
  }
  throw new Error(`no unit id under 1000 assigns to ${variant}`);
};

// Scoped to a row and exact: MarketSummary renders an ▲ of its own, so asserting
// the glyph against the page passes with the pill entirely broken.
const expectVariant = async (page: Page, variant: ChangePillVariant) => {
  const row = page.getByRole('link', { name: /Ethereum/ });
  await expect(row).toContainText('+2.50%');
  if (variant === 'arrow') await expect(row).toContainText('▲');
  else await expect(row).not.toContainText('▲');
};

test.describe('Experiments (server-assigned)', () => {
  test('bakes the assigned variant into the HTML, before any client JS runs', async ({
    browser,
    baseURL,
  }) => {
    // Arrange — a returning user pinned to `arrow`, in a context that runs no JS
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies([
      { name: UID_COOKIE, value: unitIdFor('arrow'), url: baseURL! },
    ]);
    const page = await context.newPage();

    // Act
    await page.goto('/');

    // Assert
    await expectVariant(page, 'arrow');
    await context.close();
  });

  test('leaves the control group exactly as it shipped', async ({
    browser,
    baseURL,
  }) => {
    // Arrange
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies([
      { name: UID_COOKIE, value: unitIdFor('control'), url: baseURL! },
    ]);
    const page = await context.newPage();

    // Act
    await page.goto('/');

    // Assert — control is the pre-experiment behaviour, not a second treatment
    await expectVariant(page, 'control');
    await context.close();
  });

  test('keeps the arrow out of the accessible name', async ({
    browser,
    baseURL,
  }) => {
    // Arrange — the treatment arm, where there is a glyph to leak
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies([
      { name: UID_COOKIE, value: unitIdFor('arrow'), url: baseURL! },
    ]);
    const page = await context.newPage();

    // Act
    await page.goto('/');

    // Assert — a decorative glyph inside the label would make this a change to
    // what a screen reader announces, which is not the experiment
    await expect(
      page.getByRole('link', { name: /Ethereum/ }),
    ).not.toHaveAccessibleName(/▲/);
    await context.close();
  });

  // The path every test above skips by arriving with a cookie: the id is minted,
  // bridged onto the request header, rendered from, and written back. Break any
  // link and a first-time visitor silently falls through to 'anonymous' — no
  // error, and every returning-user assertion still passes.
  test('assigns a first-time visitor on the response they arrived for', async ({
    browser,
  }) => {
    // The minted id cannot be chosen — the server draws it — so the assertion is
    // the AGREEMENT property instead: every first response must render the arm of
    // the id it minted. On a healthy build that holds for any draw, so the test
    // never fails by luck. A broken bridge renders the fallback's arm for every
    // visitor, so any draw landing opposite the fallback exposes it; K independent
    // draws all hiding in the fallback's arm is 2^-K (~1/4096), and the next run
    // re-rolls. (The old version inverted this: it retried until a draw landed
    // opposite the fallback and failed a HEALTHY build when none did.)
    const VISITS = 12;

    for (let i = 0; i < VISITS; i++) {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto('/');

      // Assert — the proxy minted an id and wrote it back
      const unitId = (await context.cookies()).find(
        (cookie) => cookie.name === UID_COOKIE,
      )?.value;
      expect(unitId).toMatch(UUID);

      // Assert — and that same id decided what this very response rendered,
      // which is the whole point of the request-header bridge
      const assigned = assignVariant(unitId!, CHANGE_PILL_STYLE);
      await expectVariant(page, assigned);

      if (i === VISITS - 1) {
        // Act — a second visit from this visitor, now carrying the cookie
        await page.reload();

        // Assert — the cookie preserved the assignment rather than re-rolling it
        const returning = (await context.cookies()).find(
          (cookie) => cookie.name === UID_COOKIE,
        );
        expect(returning?.value).toBe(unitId);
        await expectVariant(page, assigned);
      }
      await context.close();
    }
  });

  // The header is the server's only input, so a caller who can set it can choose
  // their own arm — and a proxy that leaves an inbound one alone lets them.
  test('ignores an inbound x-kpw-uid', async ({ browser, baseURL }) => {
    // Arrange — a user the hash puts in control, asking to be in `arrow`
    const context = await browser.newContext({
      javaScriptEnabled: false,
      extraHTTPHeaders: { 'x-kpw-uid': unitIdFor('arrow') },
    });
    await context.addCookies([
      { name: UID_COOKIE, value: unitIdFor('control'), url: baseURL! },
    ]);
    const page = await context.newPage();

    // Act
    await page.goto('/');

    // Assert — the cookie decided, not the header
    await expectVariant(page, 'control');
    await context.close();
  });
});
