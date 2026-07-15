import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// For a page the test made itself, e.g. in a context with its own colour scheme.
export const scanPage = (page: Page) =>
  new AxeBuilder({ page }).withTags(WCAG_AA);

// A scanner per test, so the ruleset is declared once. Call it at whatever state
// the test has driven the page to — a scan on load only ever checks the state the
// server sent.
export const test = base.extend<{ makeAxeBuilder: () => AxeBuilder }>({
  makeAxeBuilder: async ({ page }, use) => {
    await use(() => scanPage(page));
  },
});

// Reported as rule ids: a failure names the rule instead of dumping the DOM.
export const summarise = (violations: { id: string; nodes: unknown[] }[]) =>
  violations.map((violation) => `${violation.id} (${violation.nodes.length})`);

export { expect };
