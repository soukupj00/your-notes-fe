import { expect, type Page, test } from '@playwright/test';
import { signedOutServer, skipTour } from './helpers';

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

test.describe('the Settings home without an account', () => {
  const card = (page: Page) => page.locator('section', { hasText: 'Notes stay on this device' });

  test('with no server, offers a backup and the way to a server', async ({ page }) => {
    await page.goto('/settings');

    await expect(card(page).getByRole('button', { name: 'Back up' })).toBeVisible();
    await expect(card(page).getByRole('link', { name: 'Sync with your own server' })).toBeVisible();
  });

  test('on a server with no Owner, offers only the setup guide', async ({ page }) => {
    await signedOutServer(page, { setupNeeded: true });
    await page.goto('/settings');

    await expect(card(page).getByRole('link', { name: 'Setup guide' })).toBeVisible();
    await expect(card(page).getByRole('button')).toHaveCount(0);
  });

  test('on a server with an Owner, offers Sign in', async ({ page }) => {
    await signedOutServer(page);
    await page.goto('/settings');

    await card(page).getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
  });
});
