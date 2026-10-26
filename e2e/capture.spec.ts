import { expect, test } from '@playwright/test';
import { closeNote, skipTour, startNote } from './helpers';

test.describe('capture starts', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('Image opens the picker in the tap and the picture lands in a new note', async ({
    page,
  }) => {
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Image');
    const picker = await chooser;
    expect(picker.isMultiple()).toBe(true);
    await picker.setFiles({
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(1);
  });

  test('Camera asks for the camera', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a desktop browser ignores `capture`, so desktop offers File instead');
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Camera');
    const picker = await chooser;
    const input = picker.element();
    expect(await input.getAttribute('capture')).toBe('environment');
    expect(await input.getAttribute('accept')).toBe('image/*');
  });

  test('File on desktop takes any file and lands it as a file', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the phone keeps Camera in this slot');
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'File');
    const picker = await chooser;
    expect(await picker.element().getAttribute('capture')).toBeNull();
    await picker.setFiles({
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
    });

    await expect(page.getByRole('dialog').getByText('notes.pdf')).toBeVisible();
  });

  test('the search box sits centred over the capture bar, at its width', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'the phone has no capture bar, only the dial');
    const search = page.getByRole('searchbox').locator('..');
    const bar = page.locator('[data-tour="capture"]:visible');

    // Tablet widths too: the open sidebar leaves the header too narrow for search between its
    // controls there, which once put the box off centre at 768 and 1024.
    for (const width of [700, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await bar.waitFor();
      const [s, b] = [await search.boundingBox(), await bar.boundingBox()];
      if (!s || !b) throw new Error('both must be on screen');
      expect(Math.abs(s.width - b.width), `width at ${width}px`).toBeLessThanOrEqual(1);
      expect(
        Math.abs(s.x + s.width / 2 - (b.x + b.width / 2)),
        `centre at ${width}px`
      ).toBeLessThanOrEqual(1);
    }
  });

  test('Voice note starts recording at once, whatever the toolbar shows', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['microphone']);
    await startNote(page, 'Voice note');

    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    // The media menu was never opened: the recorder no longer lives in it.
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('Forward after closing a Start reopens the saved note plain', async ({ page }) => {
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('Milk');
    await closeNote(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goForward();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The saved item, not the Start's empty seed: the note did not reopen as a blank draft.
    await expect(dialog.getByText('Milk')).toBeVisible();
  });
});
