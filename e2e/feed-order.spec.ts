import { expect, type Page, test } from '@playwright/test';
import { card, closeNote, newTextNote, skipTour } from './helpers';

/** The Card titles, top to bottom, under the default "last edited" sort. */
const order = (page: Page) => page.locator('[data-slot="card"] h2').allInnerTexts();

test.describe('feed order on the default sort (ADR 0012, feedback B4)', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
    for (const title of ['A', 'B', 'C']) await newTextNote(page, title);
    await expect.poll(() => order(page)).toEqual(['C', 'B', 'A']);
  });

  test('an edited Note moves to the top once its editor closes', async ({ page }) => {
    await card(page, 'A').getByRole('heading', { name: 'A' }).click();
    await page.locator('.tiptap').click();
    await page.keyboard.type('edited');
    await closeNote(page);

    await expect.poll(() => order(page)).toEqual(['A', 'C', 'B']);
  });

  test('a Note only read stays where it was, after a reload too', async ({ page }) => {
    await card(page, 'A').getByRole('heading', { name: 'A' }).click();
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('A');
    await closeNote(page);
    // The editor closes only once its last write has landed.
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect.poll(() => order(page)).toEqual(['C', 'B', 'A']);

    await page.reload();
    await expect.poll(() => order(page)).toEqual(['C', 'B', 'A']);
  });
});
