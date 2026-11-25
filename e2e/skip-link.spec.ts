import { expect, test } from '@playwright/test';
import { skipTour } from './helpers';

test('the skip link shows as a small chip in the corner while focused, and is gone after', async ({
  page,
}) => {
  await skipTour(page);
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Skip to content' });
  await link.focus();

  // Polled: it slides in.
  await expect
    .poll(async () => {
      const box = await link.boundingBox();
      return box && box.y >= 0 && box.height < 60 && box.width < 200;
    })
    .toBe(true);

  await link.blur();
  await expect.poll(async () => ((await link.boundingBox())?.y ?? 0) + 60 <= 0).toBe(true);
});
