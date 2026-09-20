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
    await expect(chip).toContainText(/0?9:00/);

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

    // The download fires during the hand-off, before the Note is written and
    // before the popover closes. Re-clicking the bell while it is still open
    // would toggle it shut, so wait for the popover to be gone first. The field
    // is what to wait on rather than the primary action: that button renames
    // itself to "Update in calendar" the moment the Reminder is recorded, which
    // is one render *before* the popover closes.
    await expect(page.getByLabel('Date and time')).toBeHidden();

    await page.getByRole('button', { name: 'Reminder' }).click();

    // With a Reminder set the popover carries both actions, and side by side
    // their labels are wider than the popover. Measured rather than assumed:
    // every button must sit inside the popover's box and show its whole label.
    const popover = page.getByTestId('reminder-popover');
    const box = await popover.boundingBox();
    for (const button of await popover.getByRole('button').all()) {
      const b = await button.boundingBox();
      expect(b?.x).toBeGreaterThanOrEqual(box?.x ?? 0);
      expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0));
      expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }

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
      const w = globalThis as unknown as { __shareCalls: number };
      w.__shareCalls = 0;
      Object.assign(navigator, {
        canShare: () => true,
        share: async () => {
          w.__shareCalls += 1;
          throw new DOMException('cancelled', 'AbortError');
        },
      });
    });
    await freshWall(page);
    await openNewNote(page, isMobile);
    await setWeeklyReminder(page);
    await page.getByRole('button', { name: 'Add to calendar' }).click();

    // Without this the test is an absence that was already true before the tap:
    // Escape could land before the share was even reached, and it would pass
    // whatever the app does with a dismissal.
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as unknown as { __shareCalls: number }).__shareCalls)
      )
      .toBe(1);

    await page.keyboard.press('Escape');
    await page.goBack();

    await expect(page.getByText('Call the dentist')).toBeVisible();
    await expect(page.getByTestId('reminder-chip')).toHaveCount(0);
  });
});
