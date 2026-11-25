import { expect, type Page, test } from '@playwright/test';
import { closeNote, drawText, skipTour, startNote } from '../helpers.ts';

// Strings, not callbacks: `tsconfig.node.json` has no DOM lib (see `skipTour`).
const RECORD_VIOLATIONS = `window.violations = [];
document.addEventListener('securitypolicyviolation', (event) => {
  window.violations.push(event.effectiveDirective + ' ' + event.blockedURI);
});`;

const INJECT = `document.body.insertAdjacentHTML('beforeend',
  '<img src="/missing.png" onerror="window.injected = true">' +
  '<img src="https://example.com/tracker.png">');`;

function violations(page: Page) {
  return page.evaluate('window.violations') as Promise<string[]>;
}

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.addInitScript(RECORD_VIOLATIONS);
});

test('a Note and a Drawing with text run under the policy without a violation', async ({
  page,
}) => {
  await page.goto('/');
  await startNote(page, 'Note');
  await page.getByRole('textbox', { name: 'Title' }).fill('Policy');
  await closeNote(page);
  await drawText(page, 'Hello');

  expect(await violations(page)).toEqual([]);
});

test('markup injected into the page runs no script and reaches no other origin', async ({
  page,
  baseURL,
}) => {
  // A blocked request is still raised as a request; how it failed tells whether it left.
  const outbound: string[] = [];
  const isOutbound = (url: string) => !url.startsWith(baseURL ?? '');
  page.on('requestfinished', (request) => {
    if (isOutbound(request.url())) outbound.push(`${request.url()} sent`);
  });
  page.on('requestfailed', (request) => {
    if (isOutbound(request.url()))
      outbound.push(`${request.url()} ${request.failure()?.errorText}`);
  });
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'attached' });

  await page.evaluate(INJECT);

  await expect
    .poll(async () => (await violations(page)).sort())
    .toEqual(['img-src https://example.com/tracker.png', 'script-src-attr inline']);
  expect(await page.evaluate('window.injected === undefined')).toBe(true);
  await expect.poll(() => outbound).toEqual(['https://example.com/tracker.png csp']);
});
