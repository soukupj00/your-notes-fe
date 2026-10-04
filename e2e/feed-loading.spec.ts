import { expect, type Page, test } from '@playwright/test';
import { skipTour } from './helpers';

// Page scripts are strings: this folder is type-checked without the DOM library.

/** Counts, in `window.loadingFrames`, the frames on which the feed's loading line was painted. */
const COUNT_LOADING_FRAMES = `
  window.loadingFrames = 0;
  const tick = () => {
    const status = document.querySelector('main [role="status"][aria-busy]');
    if (status && Number(getComputedStyle(status).opacity) > 0) window.loadingFrames += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
`;

async function openFeed(page: Page) {
  await skipTour(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
}

test('switching between Notes, Archive and Trash paints no loading line', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the sidebar links are in a drawer on a phone');
  await openFeed(page);
  await page.evaluate(COUNT_LOADING_FRAMES);

  for (const name of ['Archive', 'Trash', 'Notes']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.locator('main [role="status"][aria-busy]')).toHaveCount(0);
    await page.waitForTimeout(100);
  }

  expect(await page.evaluate('window.loadingFrames')).toBe(0);
});

test('a wait that lasts still gets its loading line', async ({ page }) => {
  await openFeed(page);
  const opacity = () => page.evaluate(`getComputedStyle(document.querySelector('#late')).opacity`);

  await page.evaluate(
    `document.body.insertAdjacentHTML('beforeend', '<div id="late" class="appear-late">x</div>')`
  );

  expect(await opacity()).toBe('0');
  await expect.poll(opacity).toBe('1');
});
