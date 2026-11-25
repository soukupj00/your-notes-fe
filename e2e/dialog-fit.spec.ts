import { expect, type Locator, test } from '@playwright/test';
import { signedOutServer, skipTour, startNote } from './helpers';

async function settledBox(dialog: Locator) {
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations().map((a: { finished: Promise<unknown> }) => a.finished))
  );
  const box = await dialog.boundingBox();
  if (!box) throw new Error('no dialog box');
  return box;
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
