import { expect, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  // Without the picker the export is a plain download, which Playwright can catch.
  await page.addInitScript('delete window.showSaveFilePicker;');
});

test('importing a backup adds its notes and keeps the ones written since', async ({ page }) => {
  await page.goto('/');
  await newTextNote(page, 'In the backup');

  await page.goto('/settings/data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const file = await (await download).path();

  await page.goto('/');
  await card(page, 'In the backup').getByRole('button', { name: 'Move to trash' }).click();
  await newTextNote(page, 'Written later');

  await page.goto('/settings/data');
  await page.getByLabel('Import a backup').setInputFiles(file);
  const dialog = page.getByRole('dialog', { name: 'Import this backup?' });
  await dialog.getByText('Save a backup of my current data first').click();
  await dialog.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText('Backup imported.')).toBeVisible();

  await page.goto('/');
  await expect(card(page, 'Written later')).toHaveCount(1);
  await expect(card(page, 'In the backup')).toHaveCount(1);
});
