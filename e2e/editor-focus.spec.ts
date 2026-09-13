import { expect, test } from '@playwright/test';
import { newTextNote, skipTour, startNote } from './helpers';

test.describe('opening focus', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('a new note opens with the title focused', async ({ page }) => {
    await startNote(page, 'Note');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
  });

  test('an existing note opens with nothing focused on a phone, and the title focused on a desktop', async ({
    page,
    isMobile,
  }) => {
    await newTextNote(page, 'Kept', 'some text');
    await page.getByRole('heading', { name: 'Kept' }).click();

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect(title).toHaveValue('Kept');
    if (isMobile) {
      await expect(title).not.toBeFocused();
      await expect(page.locator('.tiptap')).not.toBeFocused();
    } else {
      await expect(title).toBeFocused();
    }
  });
});
