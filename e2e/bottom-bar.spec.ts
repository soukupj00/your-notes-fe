import { expect, type Locator, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

/** The box once it holds still for a frame: a new card's placement lands a frame after it renders. */
async function stillBox(locator: Locator) {
  await locator.evaluate(`(element) => new Promise((resolve) => {
    let last = '';
    const check = () => {
      const { x, y } = element.getBoundingClientRect();
      if (x + ',' + y === last) return resolve();
      last = x + ',' + y;
      requestAnimationFrame(check);
    };
    check();
  })`);
  const box = await locator.boundingBox();
  if (!box) throw new Error('no box');
  return box;
}

// A desktop browser zoomed into the phone layout. The `＋` strip spans the whole
// bottom edge, so it must take the pointer only on its own button.
test('a card under the floating ＋ strip still takes clicks', async ({ page }) => {
  // What is tested is where a tap lands, and a card still sliding to its place moves it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 512, height: 360 });
  await skipTour(page);
  await page.goto('/');
  for (const title of ['A', 'B', 'C', 'D']) await newTextNote(page, title, `Body of ${title}`);

  // Newest first, so B sits bottom-left, away from the ＋ in the right corner.
  // The window is cut just below its trash button, which puts the button inside the strip.
  const trash = card(page, 'B').getByRole('button', { name: 'Move to trash' });
  const top = await stillBox(trash);
  await page.setViewportSize({ width: 512, height: Math.ceil(top.y + top.height + 12) });
  const box = await stillBox(trash);

  // A raw click, not `trash.click()`: the bug is exactly that something else is hit there.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(card(page, 'B')).toHaveCount(0);
});

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
