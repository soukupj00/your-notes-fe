import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const MEDIA_ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];

/**
 * Runs on `pnpm dev`, which serves no service worker, so no cached bundle can stand in for the
 * code under test; `playwright.pwa.config.ts` covers the worker. How this suite splits from
 * Vitest: CLAUDE.md "Commands" and ADR 0003.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'pwa/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // The specs assert on English copy, and i18next picks the language from the
    // browser. Pinning it here keeps a spec from failing on a Czech laptop.
    locale: 'en-GB',
  },
  projects: [
    // Both widths, deliberately: several targets are mounted at both with one invisible, so one
    // width would pass while the other pointed at nothing. The fake media device lets
    // `getUserMedia` resolve headlessly.
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: MEDIA_ARGS },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { args: MEDIA_ARGS },
      },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
