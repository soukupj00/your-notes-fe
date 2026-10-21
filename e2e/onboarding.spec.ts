import { expect, type Page, test } from '@playwright/test';

/**
 * The first-run guides' acceptance test (ADR 0024): the Welcome at launch, the Tour on the first
 * visit to Settings. Both are found by test id: the rest of the page is `inert` while either is
 * up, which takes it out of the accessibility tree.
 */

const STEP_TITLES = ['Your toolbar', 'Ways to start a note', 'Where your notes live'] as const;

function welcome(page: Page) {
  return page.getByTestId('welcome');
}

function popover(page: Page) {
  return page.getByTestId('tour-popover');
}

/** Welcome already dismissed, so only the Tour is under test. Kept once the app writes its own. */
async function seenWelcome(page: Page) {
  await page.addInitScript(
    `if (!localStorage.getItem('preferences')) localStorage.setItem('preferences', ${JSON.stringify(
      JSON.stringify({ version: 2, welcomeSeenAt: '2026-01-01T00:00:00.000Z' })
    )});`
  );
}

async function expectStep(page: Page, step: number) {
  await expect(popover(page)).toContainText(`Step ${step} of ${STEP_TITLES.length}`);
  await expect(popover(page).getByRole('heading')).toHaveText(STEP_TITLES[step - 1]);
  await expect(page).toHaveURL(/\/settings$/);
}

/** Nothing left inert and nothing of a guide on screen. */
async function expectAppBack(page: Page) {
  await expect(popover(page)).toBeHidden();
  await expect(welcome(page)).toBeHidden();
  await expect(page.locator('body > [inert]')).toHaveCount(0);
}

async function expectSettingsBack(page: Page) {
  await expectAppBack(page);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
}

test.describe('the Welcome', () => {
  test('is shown once at first launch, pointing at capture and Settings', async ({ page }) => {
    await page.goto('/');

    await expect(welcome(page)).toBeVisible();
    await expect(welcome(page).getByTestId('welcome-mark-capture')).toBeVisible();
    await expect(welcome(page).getByTestId('welcome-mark-settings')).toBeVisible();
    // Launch is not the Tour: that waits for Settings.
    await expect(popover(page)).toBeHidden();
    await expect(welcome(page).getByRole('button', { name: 'Got it' })).toBeFocused();

    await welcome(page).getByRole('button', { name: 'Got it' }).click();
    await expectAppBack(page);
    await expect(page.getByText('No notes yet')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    await page.reload();
    await expect(page.getByText('No notes yet')).toBeVisible();
    await expect(welcome(page)).toBeHidden();
  });

  test('Escape dismisses it', async ({ page }) => {
    await page.goto('/');
    await expect(welcome(page)).toBeVisible();

    await page.keyboard.press('Escape');

    await expectAppBack(page);
  });

  test('Back closes it with the Feed it marks', async ({ page, isMobile }) => {
    await page.goto('/trash');
    if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('link', { name: 'Notes', exact: true }).click();
    await expect(welcome(page)).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/trash$/);
    await expectAppBack(page);
  });
});

test.describe('the Tour', () => {
  test.beforeEach(async ({ page }) => seenWelcome(page));

  test('is offered on the first visit to Settings and walks it with Next and Back', async ({
    page,
  }) => {
    // A spent `waitFor` budget is always a bug, and silent by design (it returns null), so a stall
    // once read as a slow step. Both breakpoints matter: it fired at 1280px and not at 390px.
    const timeouts: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('[tour] timed out')) timeouts.push(m.text());
    });

    await page.goto('/');
    await expect(page.getByText('No notes yet')).toBeVisible();
    await expect(popover(page)).toBeHidden();

    await page.goto('/settings');
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

  test('Done leaves the user in Settings', async ({ page }) => {
    await page.goto('/settings');
    for (let step = 1; step < STEP_TITLES.length; step++) {
      await expectStep(page, step);
      await popover(page).getByRole('button', { name: 'Next' }).click();
    }
    await expectStep(page, STEP_TITLES.length);

    await popover(page).getByRole('button', { name: 'Done' }).click();

    await expectSettingsBack(page);
  });

  test('Skip ends it from any step and leaves the user in Settings', async ({ page }) => {
    await page.goto('/settings');
    await popover(page).getByRole('button', { name: 'Next' }).click();
    await expectStep(page, 2);

    await popover(page).getByRole('button', { name: 'Skip' }).click();

    await expectSettingsBack(page);
  });

  test('a navigation it did not make ends it', async ({ page }) => {
    // The app is inert, so the platform Back is the only way out, and it means the user left.
    await page.goto('/');
    await page.getByRole('link', { name: 'Settings' }).click();
    await expectStep(page, 1);

    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expectAppBack(page);
  });

  test('a second visit does not offer it again', async ({ page }) => {
    // Stamped when it is offered, or it would re-arm on every reload.
    await page.goto('/settings');
    await expectStep(page, 1);

    await page.goto('/settings');

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(popover(page)).toBeHidden();
  });

  test('Settings replays it', async ({ page }) => {
    await page.goto('/settings');
    await popover(page).getByRole('button', { name: 'Skip' }).click();
    await expectSettingsBack(page);

    await page.getByRole('button', { name: 'Replay tutorial' }).click();

    await expectStep(page, 1);
  });
});
