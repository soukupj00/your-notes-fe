import { readFile, writeFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { skipTour } from '../helpers.ts';

// `vite preview` reads files from disk per request, so rewriting the built worker publishes an update.
const WORKER = new URL('../../dist/sw.js', import.meta.url);
const NEXT_WORKER_ANSWERS = `
self.addEventListener('message', (event) => {
  if (event.data === 'which worker') event.ports[0].postMessage('next');
});`;

let builtWorker: string;

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  builtWorker = await readFile(WORKER, 'utf8');
});

test.afterEach(async () => {
  await writeFile(WORKER, builtWorker);
});

const publishUpdate = () => writeFile(WORKER, builtWorker + NEXT_WORKER_ANSWERS);

// Strings, not callbacks: `tsconfig.node.json` has no DOM lib (see `skipTour`).
async function firstVisit(page: Page) {
  await page.goto('/');
  await page.waitForFunction('navigator.serviceWorker.controller !== null', undefined, {
    timeout: 20_000,
  });
  await page.evaluate('window.notReloaded = true');
}

const RELOADED = 'window.notReloaded === undefined';

/** Whether the next worker, not the one this page was first served by, controls the page. */
const UNDER_NEXT_WORKER = `new Promise((resolve) => {
  const channel = new MessageChannel();
  channel.port1.onmessage = (event) => resolve(event.data === 'next');
  navigator.serviceWorker.controller.postMessage('which worker', [channel.port2]);
  setTimeout(() => resolve(false), 2000);
})`;

test('Reload on the update toast moves the tab that first installed the worker', async ({
  page,
}) => {
  await firstVisit(page);

  await publishUpdate();
  await page.evaluate('navigator.serviceWorker.getRegistration().then((r) => r.update())');
  await page.getByRole('button', { name: 'Reload' }).click();

  await page.waitForFunction(RELOADED, undefined, { timeout: 20_000 });
  expect(await page.evaluate(UNDER_NEXT_WORKER)).toBe(true);
});
