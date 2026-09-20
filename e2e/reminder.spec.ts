import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/**
 * Reminders' acceptance test (ADR 0021), written before the feature.
 *
 * The app never notifies, so there is nothing to wait for at the reminder's
 * time. What can be pinned is the Hand-off: the tap that sets a Reminder must
 * produce a calendar file, and the record must survive on the Card.
 */

/** A fresh profile is offered the Tour, which makes the whole app inert. */
async function freshWall(page: Page) {
  await page.goto('/');
  await page.getByTestId('tour-popover').getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('No notes yet')).toBeVisible();
}

async function openNewNote(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'New note' }).click();
    await page.getByRole('button', { name: 'Note', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Take a note…' }).click();
  }
  await page.getByRole('textbox', { name: 'Title' }).fill('Call the dentist');
}

async function setWeeklyReminder(page: Page) {
  await page.getByRole('button', { name: 'Reminder' }).click();
  await page.getByLabel('Date and time').fill('2030-03-04T09:00');
  await page.getByLabel('Repeat').selectOption('weekly');
}

test.describe('Reminders', () => {
  test('setting one hands a calendar file over and leaves a chip on the Card', async ({
    page,
    isMobile,
  }) => {
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    const download = await downloading;

    expect(download.suggestedFilename()).toBe('reminder.ics');
    const ics = await readFile(await download.path(), 'utf8');
    expect(ics).toContain('SUMMARY:Call the dentist');
    expect(ics).toContain('DTSTART:20300304T090000\r\n'); // floating: no Z
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toMatch(/URL:http:\/\/[^\r]+\?note=[0-9a-f-]{36}/);

    // The open Note lives in the URL (ADR 0014), so back closes the editor.
    await page.goBack();
    const chip = page.getByTestId('reminder-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('09:00');

    await page.reload();
    await expect(page.getByTestId('reminder-chip')).toBeVisible();
  });

  test('clearing removes the chip', async ({ page, isMobile }) => {
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    await downloading;

    await page.getByRole('button', { name: 'Reminder' }).click();
    await page.getByRole('button', { name: 'Clear reminder' }).click();
    await page.goBack();

    await expect(page.getByText('Call the dentist')).toBeVisible();
    await expect(page.getByTestId('reminder-chip')).toHaveCount(0);
  });

  test('on a phone that can share files, the calendar file goes to the share sheet', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'sharing is only attempted on a coarse pointer');
    await page.addInitScript(() => {
      const w = globalThis as unknown as { __shared: { name: string; type: string }[] };
      w.__shared = [];
      Object.assign(navigator, {
        canShare: () => true,
        share: async (data?: { files?: File[] }) => {
          for (const f of data?.files ?? []) w.__shared.push({ name: f.name, type: f.type });
        },
      });
    });
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    await page.getByRole('button', { name: 'Add to calendar' }).click();

    await expect
      .poll(() => page.evaluate(() => (globalThis as unknown as { __shared: unknown[] }).__shared))
      .toEqual([{ name: 'reminder.ics', type: 'text/calendar' }]);
  });

  test('a cancelled share saves nothing', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'sharing is only attempted on a coarse pointer');
    await page.addInitScript(() => {
      Object.assign(navigator, {
        canShare: () => true,
        share: async () => {
          throw new DOMException('cancelled', 'AbortError');
        },
      });
    });
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    await page.getByRole('button', { name: 'Add to calendar' }).click();
    await page.keyboard.press('Escape');
    await page.goBack();

    await expect(page.getByText('Call the dentist')).toBeVisible();
    await expect(page.getByTestId('reminder-chip')).toHaveCount(0);
  });
});
