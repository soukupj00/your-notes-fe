import { expect, test } from '@playwright/test';
import { skipTour, startNote } from './helpers';

test('a formula is asked for in the app, previewed, and lands at the cursor', async ({ page }) => {
  await skipTour(page);
  await page.goto('/');
  await startNote(page, 'Note');
  const body = page.locator('.tiptap');
  await body.click();

  await page.keyboard.type('/math');
  await page.keyboard.press('Enter');
  const prompt = page.getByRole('dialog', { name: 'Enter LaTeX' });
  await prompt.getByRole('textbox').fill('x^2');
  await expect(prompt.getByTestId('math-preview').locator('.katex')).toBeVisible();
  await prompt.getByRole('button', { name: 'Insert' }).click();

  await expect(prompt).toBeHidden();
  await expect(body.locator('[data-type="inline-math"]')).toHaveCount(1);
  await expect(body).not.toContainText('/math');
  // Focus is back in the text, so typing carries on after the formula.
  await page.keyboard.type(' done');
  await expect(body).toContainText('done');
});

test('Escape closes the prompt and leaves the note open', async ({ page }) => {
  await skipTour(page);
  await page.goto('/');
  await startNote(page, 'Note');
  await page.locator('.tiptap').click();
  await page.keyboard.type('/math');
  await page.keyboard.press('Enter');
  const prompt = page.getByRole('dialog', { name: 'Enter LaTeX' });
  await expect(prompt).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(prompt).toBeHidden();
  await expect(page).toHaveURL(/[?&]note=/);
  await expect(page.locator('.tiptap [data-type="inline-math"]')).toHaveCount(0);
});

// The phone's default bar keeps Link inside a collapsed family, so no button can take the key.
test('the link key asks in the app when no Link button is on screen', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the wide default bar shows the Link button, whose popover answers');
  await skipTour(page);
  await page.goto('/');
  await startNote(page, 'Note');
  const body = page.locator('.tiptap');
  await body.click();
  await page.keyboard.type('docs');
  await page.keyboard.press('Control+a');

  await page.keyboard.press('Control+k');
  const prompt = page.getByRole('dialog', { name: 'Link URL' });
  await prompt.getByRole('textbox').fill('https://example.com');
  await page.keyboard.press('Enter');

  await expect(body.locator('a[href="https://example.com"]')).toHaveText('docs');
});
