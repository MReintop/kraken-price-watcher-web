import { defineConfig, devices } from '@playwright/test';

// Kept clear of the dev server's port so both can run at once.
const STUB_PORT = 4001;
const APP_PORT = 3100;

// Both upstreams point at the stub, so the build renders from fixed data.
const stubEnv = [
  `COINGECKO_BASE_URL=http://localhost:${STUB_PORT}/coingecko`,
  `KRAKEN_BASE_URL=http://localhost:${STUB_PORT}/kraken`,
].join(' ');

export default defineConfig({
  testDir: './e2e',
  // Also matches *.test.ts: Jest ignores this directory, so a mis-named file
  // would otherwise run under no runner at all.
  testMatch: '**/*.@(spec|test).ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // The stub starts first: the coin pages are SSG, so it must be serving before
  // `next build` runs or its fixtures never reach the HTML. Tests run against a
  // production build, never `next dev`.
  webServer: [
    {
      command: `STUB_PORT=${STUB_PORT} node e2e/stub/upstreams.mjs`,
      port: STUB_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: `${stubEnv} npm run build && ${stubEnv} npx next start -p ${APP_PORT}`,
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
    },
  ],
});
