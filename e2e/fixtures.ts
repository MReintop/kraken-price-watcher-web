import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// For a page the test made itself, e.g. in a context with its own colour scheme.
export const scanPage = (page: Page) =>
  new AxeBuilder({ page }).withTags(WCAG_AA);

// Every socket, not Kraken's by name: the URL is redirected at build time, so
// matching a hostname here would silently stop matching.
export const ANY_SOCKET = '**/*';

export const test = base.extend<{
  makeAxeBuilder: () => AxeBuilder;
  stubbedSocket: void;
}>({
  // Automatic, and deliberately not opt-in — a spec cannot forget it. Belt and
  // braces with the redirected build URL: nothing here reaches the exchange. A
  // spec that wants to drive ticks registers its own route on top; the later
  // registration wins.
  stubbedSocket: [
    async ({ page }, use) => {
      await page.routeWebSocket(ANY_SOCKET, (ws) => {
        ws.onMessage(() => {}); // swallow the subscribe; send no ticks
      });
      await use();
    },
    { auto: true },
  ],

  // A scanner per test, so the ruleset is declared once. Call it at whatever
  // state the test has driven the page to — a scan on load only ever checks the
  // state the server sent.
  makeAxeBuilder: async ({ page }, use) => {
    await use(() => scanPage(page));
  },
});

// Reported as rule ids: a failure names the rule instead of dumping the DOM.
export const summarise = (violations: { id: string; nodes: unknown[] }[]) =>
  violations.map((violation) => `${violation.id} (${violation.nodes.length})`);

export { expect };
