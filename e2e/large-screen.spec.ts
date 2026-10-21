import { expect, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

// The root font grows on a large screen, so the wall's JS-placed columns must grow with it, or
// bigger text would be packed into the same narrow cards.
test('a QHD screen scales the type and the wall together', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone is never this wide');
  await page.setViewportSize({ width: 2560, height: 1440 });
  await skipTour(page);
  await page.goto('/');
  await newTextNote(page, 'Wide');

  const rootPx = Number(
    await page.evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)')
  );
  expect(rootPx).toBe(20);
  const box = await card(page, 'Wide').boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(13.5 * rootPx);
});
