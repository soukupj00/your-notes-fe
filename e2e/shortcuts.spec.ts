import { expect, type Page, test } from '@playwright/test';
import { skipTour } from './helpers';

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has no keyboard, and so no Shortcuts section');
  await skipTour(page);
  await page.goto('/settings');
});

/** Clicks the keys of the row named `name` and presses `keys`. */
async function record(page: Page, name: string, keys: string) {
  await page.getByRole('button', { name: new RegExp(`^${name}: .*\\.`) }).click();
  await page.keyboard.press(keys);
}

/** Opens a new note from the Feed with its text selected. */
async function selectedText(page: Page) {
  await page.getByRole('link', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Take a note…' }).click();
  await page.locator('.tiptap').click();
  await page.keyboard.type('hello');
  await page.keyboard.press('Control+a');
  return page.locator('.tiptap');
}

test('a moved shortcut fires on its new keys only', async ({ page }) => {
  await record(page, 'Bold', 'Control+Alt+b');
  const body = await selectedText(page);

  await page.keyboard.press('Control+b');
  await expect(body.locator('strong')).toHaveCount(0);

  await page.keyboard.press('Control+Alt+b');
  await expect(body.locator('strong')).toHaveText('hello');
});

test('a cleared shortcut does nothing', async ({ page }) => {
  await page.getByRole('button', { name: 'More for Italic' }).click();
  await page.getByRole('menuitem', { name: 'Clear' }).click();
  const body = await selectedText(page);

  await page.keyboard.press('Control+i');

  await expect(body.locator('em')).toHaveCount(0);
});

test('Replace takes a combination from the action that had it', async ({ page }) => {
  await record(page, 'Quote', 'Control+Shift+8');
  await expect(page.getByText('Ctrl + Shift + 8 is already used for Bullet list.')).toBeVisible();
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(
    page.getByRole('button', { name: 'Bullet list: none. Set a shortcut' })
  ).toBeVisible();
  const body = await selectedText(page);

  await page.keyboard.press('Control+Shift+8');

  await expect(body.locator('blockquote')).toBeVisible();
  await expect(body.locator('ul')).toHaveCount(0);
});

test('a combination opens a new note from the Feed', async ({ page }) => {
  await record(page, 'New note', 'Control+Alt+n');
  await page.getByRole('link', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Take a note…' })).toBeVisible();

  await page.keyboard.press('n');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.keyboard.press('Control+Alt+n');
  await expect(page.getByRole('dialog')).toBeVisible();
});
