import { expect, type Locator, type Page, test } from '@playwright/test';
import { signedOutServer, skipTour, startNote } from './helpers';

async function settledBox(dialog: Locator) {
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations().map((a: { finished: Promise<unknown> }) => a.finished))
  );
  const box = await dialog.boundingBox();
  if (!box) throw new Error('no dialog box');
  return box;
}

/** A one-finger swipe through the DevTools Protocol; Playwright has no touch move of its own. */
async function touchDrag(page: Page, x: number, y: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }],
    });
  await touch('touchStart', y);
  for (let step = 1; step <= 6; step++) await touch('touchMove', y + (dy * step) / 6);
  await touch('touchEnd', y + dy);
}

test.beforeEach(async ({ page }) => skipTour(page));

test.describe('on a landscape phone', () => {
  // Sign in is taller than the screen here.
  test.use({ viewport: { width: 924, height: 412 } });

  test('a dialog taller than the screen stays inside it and scrolls to its last button', async ({
    page,
  }) => {
    await signedOutServer(page);
    await page.goto('/settings');
    await page
      .locator('section', { hasText: 'Notes stay on this Device' })
      .getByRole('button', { name: 'Sign in' })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    const box = await settledBox(dialog);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(412);
    await expect(dialog.getByRole('heading', { name: 'Sign in' })).toBeInViewport({ ratio: 1 });

    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    await cancel.scrollIntoViewIfNeeded();
    await expect(cancel).toBeInViewport({ ratio: 1 });
  });

  test('a toolbar menu in the open Note scrolls by touch, and a row in it still hands back the text', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the toolbar folds into menus only for a coarse pointer');
    await page.goto('/');
    await startNote(page, 'Note');
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('word');
    await page.getByTestId('toolbar-family-media').click();

    const menu = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Insert drawing' }) });
    const box = await settledBox(menu);
    await expect.poll(() => menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await touchDrag(page, box.x + box.width / 2, box.y + box.height - 10, -120);
    await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.keyboard.press('Control+a');
    await menu.getByRole('button', { name: 'Link', exact: true }).click();
    await page.getByPlaceholder('https://').fill('https://example.com');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('.ProseMirror')).toBeFocused();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const start of ['Note', 'Drawing']) {
    test(`the ${start} keeps the whole screen, not the shared dialog's height`, async ({
      page,
    }) => {
      await page.goto('/');
      await startNote(page, start);
      const content =
        start === 'Drawing' ? page.locator('canvas.interactive') : page.getByPlaceholder('Title');
      await expect(content).toBeVisible();

      // The Drawing opens over its Note, so the last dialog is the one asked for.
      const dialog = page.locator('[data-slot=dialog-content]').last();
      await expect.poll(async () => (await settledBox(dialog)).height).toBe(844);
    });
  }
});
