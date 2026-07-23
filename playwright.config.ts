import { defineConfig, devices } from '@playwright/test';

// Kept clear of the dev server's port so both can run at once.
const STUB_PORT = 4001;
const APP_PORT = 3100;

// Redirected at build time, socket included, so the bundle under test has no
// route to the exchange. Passed as env, not written inline: `VAR=value cmd` is
// shell syntax that cmd.exe does not have.
const stubEnv = {
  COINGECKO_BASE_URL: `http://localhost:${STUB_PORT}/coingecko`,
  KRAKEN_BASE_URL: `http://localhost:${STUB_PORT}/kraken`,
  NEXT_PUBLIC_KRAKEN_WS_URL: `ws://localhost:${STUB_PORT}/socket`,
  // Own build directory, so a running `next dev` cannot clobber this build.
  NEXT_DIST_DIR: '.next-e2e',
  // Next loads .env.local into the server, so a developer with a Statsig key
  // would silently hand assignment to Statsig here — and every test that
  // predicts the deterministic hash would fail (or worse, flake with their
  // network). e2e asserts the WITHOUT-key contract, same as CI, so blank it.
  STATSIG_SERVER_SECRET: '',
};

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
      command: 'node e2e/stub/upstreams.mjs',
      env: { STUB_PORT: String(STUB_PORT) },
      port: STUB_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: `npm run build && npx next start -p ${APP_PORT}`,
      env: stubEnv,
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
    },
  ],
});
