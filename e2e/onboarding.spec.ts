import { expect, type Page, test } from '@playwright/test';

/**
 * The Tour's acceptance test (ADR 0015). Props are found by text, not role: the Tour makes the rest
 * of the page `inert`, which takes it out of the accessibility tree. The popover has a test id
 * because it is portalled into driver.js's element, with no landmark to address it by.
 */

const PROP_HEADERS = ['Groceries', 'Weekend in Brno', 'Ideas'] as const;

/** The last step's advance button reads `Done`; the five before it read `Next`. */
const STEPS = 6;

function popover(page: Page) {
  return page.getByTestId('tour-popover');
}

async function expectPropsOnTheWall(page: Page) {
  for (const header of PROP_HEADERS) {
    await expect(page.getByText(header, { exact: true })).toBeVisible();
  }
}

/**
 * Settles on a positive fact, the empty feed's own copy, rather than on three absences that are
 * all true one paint before the Props are seeded.
 */
async function expectAnEmptyWall(page: Page) {
  await page.goto('/');
  await expect(page.getByText('No notes yet')).toBeVisible();
  for (const header of PROP_HEADERS) {
    await expect(page.getByText(header, { exact: true })).toHaveCount(0);
  }
}

async function finishTheTour(page: Page) {
  for (let step = 1; step < STEPS; step++) {
    await popover(page).getByRole('button', { name: 'Next' }).click();
  }
  await popover(page).getByRole('button', { name: 'Done' }).click();
}

test.describe('the Tour', () => {
  test('runs on a fresh profile and demonstrates on three Props', async ({ page }) => {
    await page.goto('/');

    await expect(popover(page)).toBeVisible();
    await expectPropsOnTheWall(page);
  });

  test('purges its Props when it finishes', async ({ page }) => {
    // A spent `waitFor` budget is always a bug, and silent by design (it returns null), so a stall
    // once read as a slow step. Both breakpoints matter: it fired at 1280px and not at 390px.
    const timeouts: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('[tour] timed out')) timeouts.push(m.text());
    });

    await page.goto('/');
    await expectPropsOnTheWall(page);

    await finishTheTour(page);

    expect(timeouts).toEqual([]);

    await expect(popover(page)).toBeHidden();
    // Step 4 leaves the Feed for /settings, so the Tour ends there.
    await expectAnEmptyWall(page);
  });

  test('Skip ends it and takes the Props with it', async ({ page }) => {
    await page.goto('/');
    await expectPropsOnTheWall(page);

    await popover(page).getByRole('button', { name: 'Skip' }).click();

    await expect(popover(page)).toBeHidden();
    await expectAnEmptyWall(page);
  });

  test('Back retreats without ending it', async ({ page }) => {
    await page.goto('/');
    await popover(page).getByRole('button', { name: 'Next' }).click();

    await popover(page).getByRole('button', { name: 'Back' }).click();

    // Step 1 is the only step with no Back, so its absence is what says we
    // arrived rather than any copy the step happens to carry.
    await expect(popover(page)).toBeVisible();
    await expect(popover(page).getByRole('button', { name: 'Back' })).toHaveCount(0);
  });

  test('a reload does not re-run it, and the Props it abandoned are swept', async ({ page }) => {
    // `onboardingSeenAt` is stamped when the Tour is offered, or it would re-arm on every reload.
    // So abandoned Props cannot wait for a next Tour: the startup sweep takes them.
    await page.goto('/');
    await expectPropsOnTheWall(page);

    await page.reload();

    await expectAnEmptyWall(page);
    await expect(popover(page)).toBeHidden();
  });

  test('Settings replays it', async ({ page }) => {
    await page.goto('/');
    await popover(page).getByRole('button', { name: 'Skip' }).click();
    await expectAnEmptyWall(page);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Replay tutorial' }).click();

    // Replay returns to the Feed and runs the same sequence, Props and all.
    await expect(popover(page)).toBeVisible();
    await expectPropsOnTheWall(page);
  });
});
