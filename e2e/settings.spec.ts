import { expect, test } from '@playwright/test';
import { skipTour } from './helpers';

test.beforeEach(async ({ page }) => skipTour(page));

test('a Settings row opens its page, and Back returns to the Settings home', async ({
  page,
  isMobile,
}) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: /Editor toolbar/ }).click();

  await expect(page).toHaveURL(/\/settings\/toolbar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editor toolbar' })).toBeAttached();
  if (isMobile) {
    await expect(page.locator('[data-slot="app-bar"]')).toContainText('Editor toolbar');
    await page.getByRole('button', { name: 'Back' }).click();
  } else {
    await page.goBack();
  }

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeAttached();
});

test('Back on a subpage opened cold goes up to the Settings home', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Back lives in the phone app bar');
  await page.goto('/settings/toolbar');

  await page.getByRole('button', { name: 'Back' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeAttached();
});
