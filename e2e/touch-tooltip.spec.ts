import { expect, test } from '@playwright/test';
import { skipTour, startNote } from './helpers';

// A tap focuses the button after its pointer events have ended, and a tooltip that opens on
// that focus is closed by the click that follows: a flash over the control just pressed.
test('a tap on a toolbar button never shows its tooltip', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a tap is the phone gesture');
  await skipTour(page);
  // A string: the e2e project compiles without DOM types.
  await page.addInitScript(`
    window.shownTooltips = [];
    new MutationObserver(() => {
      for (const tip of document.querySelectorAll('[role="tooltip"]')) {
        window.shownTooltips.push(tip.textContent);
      }
    }).observe(document, { childList: true, subtree: true });
  `);
  await page.goto('/');
  await startNote(page, 'Note');

  const bar = page.getByTestId('editor-toolbar');
  await bar.getByRole('button', { name: 'Formatting' }).tap();
  await page.getByRole('button', { name: 'Bold' }).tap();
  // Longer than the tooltip's open delay, so a late one is still caught.
  await page.waitForTimeout(1000);

  expect(await page.evaluate('window.shownTooltips')).toEqual([]);
});
