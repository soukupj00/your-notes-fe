import { expect, test } from '@playwright/test';

test('a Share Link page never asks the server who is signed in', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname === '/api' || pathname === '/api/session') asked.push(pathname);
  });
  await page.route('**/api/public/shares/**', (route) => route.fulfill({ status: 404 }));

  await page.goto('/share/no-such-token');

  await expect(page.getByText('Nothing is shared here')).toBeVisible();
  expect(asked).toEqual([]);
});
