import { expect, type Page, test } from '@playwright/test';
import { skipTour, startNote } from '../helpers.ts';

// Strings, not callbacks: `tsconfig.node.json` has no DOM lib (see `skipTour`).
const CONTROLLED = 'navigator.serviceWorker.controller !== null';

async function untilControlled(page: Page) {
  await page.waitForFunction(CONTROLLED, undefined, { timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

test('the first visit works offline, with no reload', async ({ page, context }) => {
  await page.goto('/');
  // A reload would clear this, so it proves the page that installed the worker is the one it controls.
  await page.evaluate('window.firstLoad = true');
  await untilControlled(page);

  await context.setOffline(true);
  await startNote(page, 'Note');

  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
  expect(await page.evaluate('window.firstLoad === true')).toBe(true);
});

/** Every URL in the worker's caches. */
const CACHED_URLS = `(async () => {
  const urls = [];
  for (const name of await caches.keys()) {
    for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
  }
  return urls;
})()`;

test('the app fonts are precached, Czech subsets included', async ({ page }) => {
  await page.goto('/');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');

  const urls = (await page.evaluate(CACHED_URLS)) as string[];
  for (const font of [
    'work-sans-latin-wght-normal',
    'work-sans-latin-ext-wght-normal',
    'bricolage-grotesque-latin-wght-normal',
    'bricolage-grotesque-latin-ext-wght-normal',
  ]) {
    expect(
      urls.some((url) => url.includes(font) && url.endsWith('.woff2')),
      font
    ).toBe(true);
  }
});
