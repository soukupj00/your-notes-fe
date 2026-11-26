import { expect, type Page, test } from '@playwright/test';
import { drawText, skipTour, startNote } from '../helpers.ts';

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

/** An Excalidraw language chunk: its locale code, Excalidraw's own hash, then Vite's. */
const EXCALIDRAW_LOCALE = /\/assets\/([a-z]{2,3}(?:-[A-Z]{2,3})?)-[A-Z0-9]{8}-[\w-]+\.js$/;

test("of Excalidraw's languages, only Czech is precached", async ({ page }) => {
  await page.goto('/');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');

  const urls = (await page.evaluate(CACHED_URLS)) as string[];
  const locales = urls.flatMap((url) => EXCALIDRAW_LOCALE.exec(url)?.[1] ?? []);
  expect(locales).toEqual(['cs-CZ']);
});

/** Mermaid's diagram types and their layout code, such as `flowDiagram-…`, `diagram-…`, `cytoscape.esm-…`. */
const MERMAID_DIAGRAM = /\/assets\/(\w+-)?(diagram|cytoscape)/i;

/** Every script the page loaded from the app that no cache holds yet. */
const UNCACHED_SCRIPTS = `(async () => {
  const cached = new Set(await ${CACHED_URLS});
  return performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => url.includes('/assets/') && url.endsWith('.js') && !cached.has(url));
})()`;

/** Opens it in a new Drawing and waits for the sample diagram to render. */
async function openMermaidTool(page: Page) {
  await startNote(page, 'Drawing');
  await page.getByRole('button', { name: 'More tools' }).click();
  await page.locator('.dropdown-menu-item', { hasText: 'Mermaid to Excalidraw' }).click();
  await expect(page.locator('.ttd-dialog-output-canvas-container canvas')).toBeVisible();
}

test("Mermaid's diagram types are not precached and work offline once used", async ({
  page,
  context,
}) => {
  await page.goto('/');
  await untilControlled(page);
  const precached = (await page.evaluate(CACHED_URLS)) as string[];
  expect(precached.filter((url) => MERMAID_DIAGRAM.test(url))).toEqual([]);

  await openMermaidTool(page);
  // The worker writes its cache after it answers, so going offline sooner races the writes.
  await expect.poll(() => page.evaluate(UNCACHED_SCRIPTS)).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await openMermaidTool(page);
});

test('offline, text Excalidraw takes for Mermaid still pastes into a Drawing', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await untilControlled(page);

  await context.setOffline(true);
  await startNote(page, 'Drawing');
  await page.evaluate(`navigator.clipboard.writeText('timeline for Monday')`);
  await page.locator('canvas.interactive').click();
  await page.keyboard.press('ControlOrMeta+V');

  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});

test('a Drawing opens offline though it never opened online', async ({ page, context }) => {
  await page.goto('/');
  await untilControlled(page);

  await context.setOffline(true);
  await drawText(page, 'Offline');
});
