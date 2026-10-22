import { expect, type Page, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

async function trash(page: Page, ...titles: string[]) {
  await page.goto('/');
  for (const title of titles) {
    await newTextNote(page, title);
    await card(page, title).getByRole('button', { name: 'Move to trash' }).click();
    await expect(card(page, title)).toHaveCount(0);
  }
  await page.goto('/trash');
}

async function openPreview(page: Page, title: string) {
  await card(page, title).getByRole('heading', { name: title }).click();
  return page.getByRole('dialog');
}

async function confirmDeleteForever(page: Page) {
  await page
    .getByRole('dialog', { name: 'Delete this note forever?' })
    .getByRole('button', { name: 'Delete forever' })
    .click();
}

async function expectArchivedAndPurged(page: Page, archived: string, purged: string) {
  await page.reload();
  await expect(card(page, purged)).toHaveCount(0);
  await expect(card(page, archived)).toHaveCount(0);
  await page.goto('/archive');
  await expect(card(page, archived)).toHaveCount(1);
  await expect(card(page, purged)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

test('a trashed note is archived or deleted forever from its card', async ({ page }) => {
  await trash(page, 'Keep it', 'Lose it');

  await card(page, 'Keep it').getByRole('button', { name: 'Archive' }).click();
  await expect(card(page, 'Keep it')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await card(page, 'Lose it').getByRole('button', { name: 'Delete forever' }).click();
  await confirmDeleteForever(page);
  await expect(card(page, 'Lose it')).toHaveCount(0);
  await expect(page).not.toHaveURL(/note=/);

  await expectArchivedAndPurged(page, 'Keep it', 'Lose it');
});

test('a trashed note is archived or deleted forever from its preview', async ({ page }) => {
  await trash(page, 'Keep it', 'Lose it');

  await (await openPreview(page, 'Keep it')).getByRole('button', { name: 'Archive' }).click();
  await expect(page).not.toHaveURL(/note=/);
  await expect(card(page, 'Keep it')).toHaveCount(0);

  await (await openPreview(page, 'Lose it'))
    .getByRole('button', { name: 'Delete forever' })
    .click();
  await confirmDeleteForever(page);
  await expect(page).not.toHaveURL(/note=/);
  await expect(card(page, 'Lose it')).toHaveCount(0);

  await expectArchivedAndPurged(page, 'Keep it', 'Lose it');
});

// The overlay sits over the Card, and React bubbles a portal's click to the Card it came from.
test('dismissing delete forever by clicking over the card keeps it closed', async ({ page }) => {
  await trash(page, 'Stay');
  const title = await card(page, 'Stay').getByRole('heading').boundingBox();
  if (!title) throw new Error('no card title');

  await card(page, 'Stay').getByRole('button', { name: 'Delete forever' }).click();
  await page.getByRole('dialog', { name: 'Delete this note forever?' }).waitFor();
  // Radix listens for an outside press only from a tick after the dialog mounts.
  await expect(async () => {
    await page.mouse.click(title.x + 5, title.y + 5);
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 500 });
  }).toPass();
  await expect(page).not.toHaveURL(/note=/);
  await expect(card(page, 'Stay')).toHaveCount(1);
});
