import { expect, type Page, test } from '@playwright/test';

/**
 * The Tour's acceptance test (ADR 0023). The popover has a test id because it is portalled into
 * driver.js's element, with no landmark to address it by; the rest of the page is `inert`, which
 * takes it out of the accessibility tree.
 */

const STEP_TITLES = ['Your toolbar', 'Ways to start a note', 'Where your notes live'] as const;

function popover(page: Page) {
  return page.getByTestId('tour-popover');
}

async function expectStep(page: Page, step: number) {
  await expect(popover(page)).toContainText(`Step ${step} of ${STEP_TITLES.length}`);
  await expect(popover(page).getByRole('heading')).toHaveText(STEP_TITLES[step - 1]);
  await expect(page).toHaveURL(/\/settings$/);
}

/** The Tour handed the app back: no popover, nothing left inert, an empty Feed on screen. */
async function expectTheFeedBack(page: Page) {
  await expect(popover(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('body > [inert]')).toHaveCount(0);
  await expect(page.getByText('No notes yet')).toBeVisible();
}

test.describe('the Tour', () => {
  test('is offered on a first visit and walks Settings with Next and Back', async ({ page }) => {
    // A spent `waitFor` budget is always a bug, and silent by design (it returns null), so a stall
    // once read as a slow step. Both breakpoints matter: it fired at 1280px and not at 390px.
    const timeouts: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('[tour] timed out')) timeouts.push(m.text());
    });

    await page.goto('/');
    await expectStep(page, 1);
    // Step 1 is the only step with no Back, so its absence says we are at the start.
    await expect(popover(page).getByRole('button', { name: 'Back' })).toHaveCount(0);

    await popover(page).getByRole('button', { name: 'Next' }).click();
    await expectStep(page, 2);
    await popover(page).getByRole('button', { name: 'Next' }).click();
    await expectStep(page, 3);

    await popover(page).getByRole('button', { name: 'Back' }).click();
    await expectStep(page, 2);
    await popover(page).getByRole('button', { name: 'Back' }).click();
    await expectStep(page, 1);

    expect(timeouts).toEqual([]);
  });

  test('Done returns to the Feed, with no notes left behind', async ({ page }) => {
    await page.goto('/');
    for (let step = 1; step < STEP_TITLES.length; step++) {
      await expectStep(page, step);
      await popover(page).getByRole('button', { name: 'Next' }).click();
    }
    await expectStep(page, STEP_TITLES.length);

    await popover(page).getByRole('button', { name: 'Done' }).click();

    await expectTheFeedBack(page);
  });

  test('Skip ends it from any step', async ({ page }) => {
    await page.goto('/');
    await popover(page).getByRole('button', { name: 'Next' }).click();
    await expectStep(page, 2);

    await popover(page).getByRole('button', { name: 'Skip' }).click();

    await expectTheFeedBack(page);
  });

  test('a navigation it did not make ends it', async ({ page }) => {
    // The app is inert, so the platform Back is the only way out, and it means the user left.
    await page.goto('/');
    await expectStep(page, 1);

    await page.goBack();

    await expectTheFeedBack(page);
  });

  test('a second visit does not offer it again', async ({ page }) => {
    // `onboardingSeenAt` is stamped when the Tour is offered, or it would re-arm on every reload.
    await page.goto('/');
    await expectStep(page, 1);

    await page.goto('/');

    await expect(page.getByText('No notes yet')).toBeVisible();
    await expect(popover(page)).toBeHidden();
  });

  test('Settings replays it', async ({ page }) => {
    await page.goto('/');
    await popover(page).getByRole('button', { name: 'Skip' }).click();
    await expectTheFeedBack(page);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Replay tutorial' }).click();

    await expectStep(page, 1);
  });
});
