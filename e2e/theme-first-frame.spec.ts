import { expect, test } from '@playwright/test';

/**
 * `index.html` sets the theme before the app's module runs, so a dark theme never paints the day
 * canvas first. The module is held back here, leaving only what `index.html` does on its own.
 */

for (const { stored, os } of [
  { stored: 'dark', os: 'light' },
  { stored: 'light', os: 'dark' },
] as const) {
  test(`a stored ${stored} theme on a ${os} OS is set before the app runs`, async ({ page }) => {
    await page.route('**/src/main.tsx', (route) => route.abort());
    await page.emulateMedia({ colorScheme: os });
    await page.addInitScript(`localStorage.setItem('vite-ui-theme', '${stored}')`);
    await page.goto('/');

    await expect(page.locator('html')).toHaveClass(stored);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', stored);
  });
}

test('the theme script blocks the parser, so it runs before the first paint', async ({ page }) => {
  await page.goto('/');

  const script = page.locator('head script[src="/theme-boot.js"]');
  await expect(script).toHaveCount(1);
  for (const attribute of ['defer', 'async', 'type']) {
    await expect(script).not.toHaveAttribute(attribute);
  }
});
