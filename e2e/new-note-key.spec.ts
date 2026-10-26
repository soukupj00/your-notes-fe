import { expect, test } from '@playwright/test';
import { skipTour } from './helpers';

// A phone's first hardware key both arms the keyboard affordances and acts (ADR 0028).
test.describe('a phone with a keyboard', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a fine pointer has them from the start');
    await skipTour(page);
  });

  test('opens a note at the first N', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New note' })).toBeVisible();

    await page.keyboard.press('n');

    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });

  test('gets the Shortcuts row after a key, not before', async ({ page }) => {
    await page.goto('/settings');
    const row = page.getByRole('link', { name: /Keyboard shortcuts/ });
    await expect(page.getByRole('link', { name: /General/ })).toBeVisible();
    await expect(row).toHaveCount(0);

    await page.keyboard.press('ArrowDown');

    await expect(row).toBeVisible();
  });

  test('keeps the Shortcuts page across a reload of the tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('link', { name: /General/ })).toBeVisible();
    await page.keyboard.press('ArrowDown');

    await page.goto('/settings/shortcuts');

    await expect(page).toHaveURL(/\/settings\/shortcuts$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Keyboard shortcuts' })
    ).toBeAttached();
  });
});

test('N under the launch Welcome opens nothing', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has no keyboard to press it on');
  await page.goto('/');
  const welcome = page.getByTestId('welcome');
  await expect(welcome).toBeVisible();
  // A click on the scrim leaves focus on body, outside the Welcome's dialog.
  await welcome.click({ position: { x: 5, y: 5 } });
  await expect(welcome).toBeVisible();

  await page.keyboard.press('n');

  await expect(page).not.toHaveURL(/note=/);
});

test.describe('the new-note key', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'a phone has no keyboard to press it on');
    await skipTour(page);
  });

  test('N on the Feed opens an empty new note', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Take a note…' })).toBeVisible();

    await page.keyboard.press('n');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });

  test('N in the search box types an n', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox');
    await search.click();

    await page.keyboard.press('n');

    await expect(search).toHaveValue('n');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('N on the Archive opens nothing', async ({ page }) => {
    await page.goto('/archive');
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeAttached();

    await page.keyboard.press('n');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(/note=/);
  });

  test('a key changed in Settings replaces N on the Feed', async ({ page }) => {
    await page.goto('/settings/shortcuts');
    await page.getByRole('button', { name: 'New note: N. Change' }).click();
    await page.keyboard.press('k');
    await page.getByRole('link', { name: 'Notes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Take a note…' })).toBeVisible();

    await page.keyboard.press('n');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.keyboard.press('k');
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('a search key the user chose', () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'a phone has no keyboard to press it on');
    await skipTour(page);
    await page.addInitScript(() => {
      const stored = JSON.parse(localStorage.getItem('preferences') ?? '{"version":2}');
      localStorage.setItem(
        'preferences',
        JSON.stringify({ ...stored, version: 2, shortcuts: { search: '/' } })
      );
    });
  });

  test('/ focuses search, and types itself once there', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox');
    await expect(search).toBeVisible();

    await page.keyboard.press('/');
    await expect(search).toBeFocused();

    await page.keyboard.type('a/b');
    await expect(search).toHaveValue('a/b');
  });

  test('Ctrl+K no longer moves to search', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('searchbox')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+k');

    await expect(page.getByRole('searchbox')).not.toBeFocused();
  });
});
