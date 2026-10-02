import { expect, type Page, test } from '@playwright/test';

/**
 * The Tour's acceptance test (ADR 0015), written before the Tour.
 *
 * This is the first spec in the suite, and the Tour is why the suite exists.
 * jsdom returns zeroed client rects, so the spotlight's only real failure mode -
 * a hole cut over nothing - is invisible to Vitest; and every step of the Tour
 * is a gesture against the whole running app (a speed dial opening, a dialog, a
 * masonry re-pack, a router navigation), which is not a shape a unit test has.
 *
 * ## The contract this pins
 *
 * Everything below is what the implementation has to provide, and none of it
 * exists yet - the file is expected to be red until task 6 lands.
 *
 * - The popover carries `data-testid="tour-popover"`. It is app-owned React
 *   portalled into driver.js's own element, so a test hook is honest here;
 *   there is no user-visible landmark to address it by.
 * - Its controls are named `Back`, `Next`, `Skip` and, on the last step, `Done`.
 * - The three Props are the ones `src/lib/tour/props.ts` seeds, addressed by the
 *   headers it writes.
 *
 * ## Why the Props are found by text and not by role
 *
 * The Tour marks every direct child of `document.body` except the popover
 * `inert`, and `inert` takes its subtree out of the accessibility tree. So while
 * the Tour is up, a Card's open button is not a button as far as `getByRole`
 * is concerned. `getByText` reads the DOM instead and is unaffected - and the same
 * property makes the popover's own buttons unambiguous, since nothing else in
 * the document has a role at all.
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
 * Waits for the wall to be demonstrably empty rather than asserting the absence
 * of each Prop in turn. An empty feed renders its own copy, so this settles on a
 * positive fact - the sweep having finished - instead of on three negatives that
 * are all true one paint before the Props are even seeded.
 */
async function expectAnEmptyWall(page: Page) {
  await page.goto('/');
  await expect(page.getByText('No notes yet')).toBeVisible();
  for (const header of PROP_HEADERS) {
    await expect(page.getByText(header, { exact: true })).toHaveCount(0);
  }
}

/** Walks the whole Tour with the buttons a user would press. */
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
    // A spent `waitFor` budget is always a bug - nothing retries - and it is
    // silent by design (`waitFor` returns null on timeout), so a three-second
    // stall once read as merely a slow step. This walks a whole run, and the
    // suite runs it at both breakpoints, which is what the stall needed: it
    // fired at 1280px and not at 390px.
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
    // `onboardingSeenAt` is stamped when step 1 renders, not on completion: the
    // fact worth recording is that the Tour was *offered*, or it re-arms after
    // every reload and closed tab.
    //
    // Which means the abandoned Props cannot wait for the next Tour, because on
    // this path there will never be one. The sweep runs at app start, beside the
    // other startup sweeps in `routes/__root.tsx`.
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
