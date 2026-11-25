import { expect, test } from '@playwright/test';
import { drawText, skipTour } from '../helpers.ts';

// Strings, not callbacks: `tsconfig.node.json` has no DOM lib (see `skipTour`).
const EXCALIFONT_LOADED = `[...document.fonts].some(
  (face) => face.family === 'Excalifont' && face.status === 'loaded'
)`;

/** Every Drawing preview in the Local Store. */
const PREVIEWS = `new Promise((resolve) => {
  const open = indexedDB.open('NotesDB');
  open.onsuccess = () => {
    const read = open.result.transaction('attachments').objectStore('attachments').getAll();
    read.onsuccess = () => resolve(read.result.map((row) => row.preview).filter(Boolean));
  };
})`;

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

test("a Drawing's text is set in Excalidraw's font, served from this origin", async ({
  page,
  baseURL,
}) => {
  const outbound: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL ?? '')) outbound.push(request.url());
  });
  await page.goto('/');

  await drawText(page, 'Hello');

  expect(await page.evaluate(EXCALIFONT_LOADED)).toBe(true);
  expect(outbound).toEqual([]);
});

test('offline, a Drawing saved with text still embeds its font', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction('navigator.serviceWorker.controller !== null', undefined, {
    timeout: 20_000,
  });
  await drawText(page, 'Online');
  await page.getByRole('button', { name: 'Close' }).click();

  await context.setOffline(true);
  await drawText(page, 'Offline');

  const previews = (await page.evaluate(PREVIEWS)) as string[];
  expect(previews).toHaveLength(2);
  for (const preview of previews) expect(preview).toContain('url(data:font/');
});
