import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * End-to-end tests (ADR 0003). The suite exists because of the Tour: jsdom
 * returns zeroed client rects, so the spotlight's only real failure mode - a
 * hole cut over nothing - is invisible to Vitest, and every act in the Tour is a
 * gesture against the real app rather than a call into a unit.
 *
 * Specs live in `e2e/`, which is outside Vitest's `src/**` include glob, so the
 * two runners cannot pick up each other's files.
 *
 * The dev server, not `preview`, is what these run against. `vite.config.ts`
 * declares no `devOptions` for `VitePWA`, so dev serves no service worker at
 * all - and a service worker deciding for itself when to hand back a cached
 * bundle is the last thing an acceptance suite needs. What it costs is that the
 * PWA install path is not covered here; that is `PwaInstallSection`'s own
 * problem and cannot be driven from a headless browser anyway.
 *
 * Each test gets a fresh browser context, which is what "fresh profile" means
 * throughout the onboarding spec: a new context has its own empty IndexedDB, so
 * `onboardingSeenAt` is unset and the Tour is due.
 */
export default defineConfig({
  testDir: './e2e',
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
    // Both, deliberately. Step 1 of the Tour has no speed dial to open above
    // `sm:` and no desktop capture bar below it, and several targets are mounted
    // at both widths with one of the two invisible - so a suite that ran at one
    // width would pass while the other pointed at nothing.
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
