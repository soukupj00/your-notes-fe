import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The service worker against the production build, since `pnpm dev` serves none. Never reuses a
 * running server, as a stale build would pass; one width, as what the worker caches does not vary.
 */
export default defineConfig({
  testDir: './e2e/pwa',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-pwa' }]]
    : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry', locale: 'en-GB' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
