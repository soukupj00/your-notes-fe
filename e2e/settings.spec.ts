import { expect, type Page, test } from '@playwright/test';
import { signedInServer, signedOutServer, skipTour } from './helpers';

test.beforeEach(async ({ page }) => skipTour(page));

/** The phone's app-bar arrow below `sm:`, the "Settings" link above the page title from `sm:` up. */
async function goBackToSettings(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Back' }).click();
  else await page.locator('#main-content').getByRole('link', { name: 'Settings' }).click();
}

test('a Settings row opens its page, and Back returns to the Settings home', async ({
  page,
  isMobile,
}) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: /Editor toolbar/ }).click();

  await expect(page).toHaveURL(/\/settings\/toolbar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Editor toolbar' })).toBeAttached();
  if (isMobile) await expect(page.locator('[data-slot="app-bar"]')).toContainText('Editor toolbar');
  await goBackToSettings(page, isMobile);

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeAttached();
});

test('Back on a subpage opened cold goes up to the Settings home', async ({ page, isMobile }) => {
  await page.goto('/settings/toolbar');

  await goBackToSettings(page, isMobile);

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeAttached();
});

// The open group is in the URL, so the phone's app-bar Back and a browser's Back both close it.
test('Back from an open toolbar group returns to the group list', async ({ page, isMobile }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: /Editor toolbar/ }).click();
  await page.getByRole('button', { name: /^Text style/ }).click();
  await expect(page.getByRole('switch', { name: /Heading 3/ })).toBeVisible();

  if (isMobile)
    await page.locator('[data-slot="app-bar"]').getByRole('button', { name: 'Back' }).click();
  else await page.goBack();

  await expect(page).toHaveURL(/\/settings\/toolbar$/);
  await expect(page.getByRole('heading', { name: 'Groups, in bar order' })).toBeVisible();
});

test('Keyboard shortcuts opened on a phone goes to the Settings home', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'a fine pointer has the page');
  await page.goto('/settings/shortcuts');

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeAttached();
});

test.describe('the Settings home without an account', () => {
  const card = (page: Page) => page.locator('section', { hasText: 'Notes stay on this Device' });

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

test('signing out on the Account page lands on the Settings home', async ({ page }) => {
  await signedInServer(page);
  await page.goto('/settings/account');

  await expect(page.getByRole('button', { name: 'Add a Device' })).toBeVisible();
  await expect(page.getByText('None shared')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out and erase' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('Notes stay on this Device')).toBeVisible();
});
