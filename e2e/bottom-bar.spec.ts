import { expect, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

// Feedback B1: a desktop browser zoomed into the phone layout. The `＋` strip spans the whole
// bottom edge, so it must take the pointer only on its own button.
test('a card under the floating ＋ strip still takes clicks', async ({ page }) => {
  await page.setViewportSize({ width: 512, height: 360 });
  await skipTour(page);
  await page.goto('/');
  for (const title of ['A', 'B', 'C', 'D']) await newTextNote(page, title, `Body of ${title}`);

  // C sits bottom-left, away from the ＋ in the right corner.
  // The window is cut just below its trash button, which puts the button inside the strip.
  const trash = card(page, 'C').getByRole('button', { name: 'Move to trash' });
  const top = await trash.boundingBox();
  if (!top) throw new Error('no trash button');
  await page.setViewportSize({ width: 512, height: Math.ceil(top.y + top.height + 12) });
  const box = await trash.boundingBox();
  if (!box) throw new Error('no trash button');

  // A raw click, not `trash.click()`: the bug is exactly that something else is hit there.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(card(page, 'C')).toHaveCount(0);
});

// Feedback U14: the open dial dims the wall, and a tap on the dim only closes the dial.
test('a tap on the dimmed wall closes the dial without opening the card under it', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the ＋ dial is the phone layout');
  await skipTour(page);
  await page.goto('/');
  await newTextNote(page, 'A');

  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.getByRole('button', { name: 'Checklist', exact: true })).toBeVisible();
  const box = await card(page, 'A').boundingBox();
  if (!box) throw new Error('no card');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByRole('button', { name: 'Checklist', exact: true })).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/note=/);
});
