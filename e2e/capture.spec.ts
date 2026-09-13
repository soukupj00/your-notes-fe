import { expect, test } from '@playwright/test';
import { skipTour, startNote } from './helpers';

test.describe('capture starts', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('Image opens the picker in the tap and the picture lands in a new note', async ({
    page,
  }) => {
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Image');
    const picker = await chooser;
    expect(picker.isMultiple()).toBe(true);
    await picker.setFiles({
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(1);
  });

  test('Camera asks for the camera', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Camera');
    const picker = await chooser;
    const input = picker.element();
    expect(await input.getAttribute('capture')).toBe('environment');
    expect(await input.getAttribute('accept')).toBe('image/*');
  });

  test('Voice note starts recording at once, whatever the toolbar shows', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['microphone']);
    await startNote(page, 'Voice note');

    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    // The media menu was never opened: the recorder no longer lives in it.
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeVisible();
  });
});
