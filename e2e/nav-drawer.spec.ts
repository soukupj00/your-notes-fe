import { expect, type Page, test } from '@playwright/test';
import { skipTour } from './helpers';

test.skip(({ isMobile }) => !isMobile, 'the drawer is the phone nav');

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Main navigation' });

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(drawer(page)).toBeVisible();
  await page.waitForFunction(
    `document.querySelector('[data-mobile="true"]')?.getAnimations().length === 0`
  );
}

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeFocused();
});

test('the drawer has its own close button, with a 44px hit box', async ({ page }) => {
  await openDrawer(page);
  const close = drawer(page).getByRole('button', { name: 'Close' });

  // The 32px disc's hit box reaches 6px past each edge (the 44px Touch Rule).
  const box = await close.boundingBox();
  if (!box) throw new Error('no box');
  expect(box.width).toBe(32);
  const y = box.y + box.height / 2;
  for (const x of [box.x - 5.5, box.x + box.width + 5.5]) {
    const hit = await page.evaluate(
      `document.elementFromPoint(${x}, ${y})?.closest('button')?.textContent`
    );
    expect(hit).toBe('Close');
  }

  await close.click();
  await expect(drawer(page)).toBeHidden();
});
