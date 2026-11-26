import { expect, type Page, test } from '@playwright/test';
import { card, closeNote, skipTour, startNote } from './helpers';

/**
 * What the browser draws itself (checkboxes, picker glyphs, scrollbars) follows the app's theme
 * through `color-scheme`, not the OS; the Drawing stays light because Excalidraw does.
 */

async function wallIn(page: Page, theme: 'light' | 'dark') {
  await skipTour(page);
  await page.addInitScript(`localStorage.setItem('vite-ui-theme', '${theme}')`);
  await page.goto('/');
}

for (const theme of ['light', 'dark'] as const) {
  test(`in the ${theme} theme a checklist box takes the ${theme} scheme`, async ({ page }) => {
    await wallIn(page, theme);
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('Milk');
    await page.getByRole('textbox', { name: 'Title' }).fill('Scheme');
    await closeNote(page);

    await expect(card(page, 'Scheme').getByRole('checkbox')).toHaveCSS('color-scheme', theme);
  });
}

test('in the dark theme the Reminder fields take the dark scheme', async ({ page }) => {
  await wallIn(page, 'dark');
  await startNote(page, 'Checklist');
  await page.getByRole('button', { name: 'Add reminder' }).click();

  await expect(page.getByLabel('Date', { exact: true })).toHaveCSS('color-scheme', 'dark');
  await expect(page.getByLabel('Repeat')).toHaveCSS('color-scheme', 'dark');
});

test('in the dark theme the Drawing keeps the light scheme', async ({ page }) => {
  await wallIn(page, 'dark');
  await startNote(page, 'Drawing');
  await expect(page.locator('canvas.interactive')).toBeVisible();

  await expect(page.locator('.excalidraw')).toHaveCSS('color-scheme', 'light');
});
