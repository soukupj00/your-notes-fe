import { expect, test } from '@playwright/test';
import { card, newTextNote, skipTour } from './helpers';

// A slow device opening a shared `?note=` link, and a user who leaves at once: the editor
// closes before the Note has loaded, while its fields are still blank.
test('a note closed before it loads is kept', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium DevTools call');
  await skipTour(page);
  await page.goto('/');
  await newTextNote(page, 'Keep me', 'Body text');
  await card(page, 'Keep me').getByRole('heading', { name: 'Keep me' }).click();
  await expect(page).toHaveURL(/note=/);
  const link = page.url();
  await page.keyboard.press('Escape');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await page.goto(link);
  await page.getByRole('dialog').waitFor();
  // Radix listens for Escape only from an effect, so the first presses can land before it.
  while (page.url().includes('note=')) await page.keyboard.press('Escape');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto('/');
  await expect(card(page, 'Keep me')).toHaveCount(1);
});
