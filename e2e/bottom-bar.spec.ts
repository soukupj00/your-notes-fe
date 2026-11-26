import { expect, type Locator, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

/** The box once it holds still for a frame: a new card's placement lands a frame after it renders. */
async function stillBox(locator: Locator) {
  // A function, not a string: `locator.evaluate` returns a string's value without calling it.
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const view = element.ownerDocument.defaultView;
        let last = '';
        const check = () => {
          const { x, y } = element.getBoundingClientRect();
          if (`${x},${y}` === last) return resolve();
          last = `${x},${y}`;
          view.requestAnimationFrame(check);
        };
        check();
      })
  );
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

test('Tab onto a control under the floating ＋ scrolls it clear', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the ＋ floats over the wall only on a phone');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await skipTour(page);
  await page.goto('/');
  for (const title of ['A', 'B']) await newTextNote(page, title);

  // Newest first, so A sits in the right column, above the ＋. The window is cut so A's trash
  // button is fully on screen but under the ＋: the browser has no reason to scroll by itself.
  const plus = page.getByRole('button', { name: 'New note' });
  const trash = card(page, 'A').getByRole('button', { name: /^Move to trash/ });
  const top = await stillBox(trash);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  await page.setViewportSize({ width: viewport.width, height: Math.ceil(top.y + top.height + 30) });
  const under = await stillBox(trash);
  const plusBox = await stillBox(plus);
  expect(under.y + under.height).toBeGreaterThan(plusBox.y);
  expect(under.x + under.width).toBeGreaterThan(plusBox.x);
  expect(under.x).toBeLessThan(plusBox.x + plusBox.width);

  await card(page, 'A')
    .getByRole('button', { name: /^Archive/ })
    .evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press('Tab');
  await expect(trash).toBeFocused();
  const focused = await stillBox(trash);
  const plusAfter = await stillBox(plus);
  expect(focused.y + focused.height).toBeLessThanOrEqual(plusAfter.y);
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
