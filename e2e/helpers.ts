import type { Page } from '@playwright/test';

/**
 * A fresh context is offered the Tour, which makes the app `inert`, so the offer is recorded as made
 * in the Preferences schema's own shape. A string, not a function: `tsconfig.node.json` has no DOM
 * lib, so a callback naming `localStorage` would not typecheck.
 */
export async function skipTour(page: Page) {
  await page.addInitScript(
    `localStorage.setItem('preferences', ${JSON.stringify(
      JSON.stringify({ version: 2, onboardingSeenAt: '2026-01-01T00:00:00.000Z' })
    )});`
  );
}

/**
 * Whichever capture surface this width shows: the dial below `sm:`, the
 * desktop bar above it. Plain text is the bar's own field there, so it has no
 * button named like the dial's; every other start is an icon with that name.
 */
export async function startNote(page: Page, start: string) {
  const dial = page.getByRole('button', { name: 'New note' });
  const bar = page.getByRole('button', { name: 'Take a note…' });
  // `isVisible` does not wait, so first wait for whichever surface this width
  // renders - a cold load has neither on screen yet.
  await dial.or(bar).waitFor();
  if (await dial.isVisible()) {
    await dial.click();
    await page.getByRole('button', { name: start, exact: true }).click();
    return;
  }
  if (start === 'Note') {
    await page.getByRole('button', { name: 'Take a note…' }).click();
    return;
  }
  await page.getByRole('button', { name: start, exact: true }).click();
}

/** Creates a text note through the UI and closes it, so it sits on the wall. */
export async function newTextNote(page: Page, title: string, body = '') {
  await startNote(page, 'Note');
  const titleField = page.getByRole('textbox', { name: 'Title' });
  await titleField.fill(title);
  if (body) {
    await page.locator('.tiptap').click();
    await page.keyboard.type(body);
  }
  await closeNote(page);
  await page.getByRole('heading', { name: title }).waitFor();
}

/** Mobile closes from the app bar's back arrow, desktop from the dialog's X. */
export async function closeNote(page: Page) {
  const back = page.getByRole('button', { name: 'Back' });
  if (await back.isVisible()) await back.click();
  else await page.getByRole('button', { name: 'Close' }).click();
}

/** A Card on the wall, found by its title. */
export function card(page: Page, title: string) {
  return page.locator('[data-slot="card"]', {
    has: page.getByRole('heading', { name: title }),
  });
}
