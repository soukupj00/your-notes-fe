import { expect, test } from '@playwright/test';
import { skipTour, startNote } from '../helpers.ts';

// The build rewrites the minified copy of the line `pnpm dev` rewrites (`excalidrawModalsInDialog`).
test("Excalidraw's Help over a Drawing closes from a click beside it", async ({ page }) => {
  await skipTour(page);
  await page.goto('/');
  await startNote(page, 'Drawing');
  await expect(page.locator('canvas.interactive')).toBeVisible();

  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.locator('.HelpDialog');
  await expect(help).toBeVisible();
  await page.locator('.Modal__background').click({ position: { x: 5, y: 5 } });
  await expect(help).toBeHidden();
});
