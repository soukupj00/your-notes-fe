import { expect, test } from '@playwright/test';
import { newTextNote, skipTour, startNote } from './helpers';

test.describe('opening focus', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('a new note opens with the title focused', async ({ page }) => {
    await startNote(page, 'Note');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
  });

  test('an existing note opens with nothing focused on a phone, and the title focused on a desktop', async ({
    page,
    isMobile,
  }) => {
    await newTextNote(page, 'Kept', 'some text');
    await page.getByRole('heading', { name: 'Kept' }).click();

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect(title).toHaveValue('Kept');
    if (isMobile) {
      await expect(title).not.toBeFocused();
      await expect(page.locator('.tiptap')).not.toBeFocused();
    } else {
      await expect(title).toBeFocused();
    }
  });
});

test.describe('keys', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  // Playwright, not Vitest: the Navbar mounts a desktop and a mobile box and only CSS says which
  // one is on screen.
  test('mod+K focuses the search box this width shows', async ({ page }) => {
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');

    await expect(page.getByRole('searchbox')).toBeFocused();
  });

  // ADR 0016: the pointer decides whether a shortcut is shown, never the width.
  test('the mod+K chip follows the pointer, not the width', async ({ page, isMobile }) => {
    await page.setViewportSize({ width: 360, height: 760 });
    await expect(page.getByRole('searchbox')).toBeVisible();

    await expect(page.locator('kbd:visible')).toHaveCount(isMobile ? 0 : 1);
  });

  // A wide bar shows the Link button and its popover; a collapsed `format` family falls back
  // to a prompt.
  test('mod+K in the body links the text and leaves search alone', async ({ page }) => {
    const url = 'https://example.com';
    page.once('dialog', (dialog) => dialog.accept(url));
    await startNote(page, 'Note');
    const body = page.locator('.tiptap');
    await body.click();
    await page.keyboard.type('a link');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+k');

    const field = page.getByRole('textbox', { name: 'Link URL' });
    const link = body.locator(`a[href="${url}"]`);
    await expect(field.or(link)).toBeVisible();
    if (await field.isVisible()) {
      await expect(field).toBeFocused();
      await field.fill(url);
      await field.press('Enter');
    }

    await expect(link).toHaveText('a link');
    await expect(body).toBeFocused();
  });

  test('Enter in the title moves to the start of the body', async ({ page }) => {
    await newTextNote(page, 'Kept', 'world');
    await page.getByRole('heading', { name: 'Kept' }).click();
    const title = page.getByRole('textbox', { name: 'Title' });
    await title.click();

    await title.press('Enter');
    await page.keyboard.type('Hello ');

    await expect(page.locator('.tiptap')).toHaveText('Hello world');
    await expect(title).toHaveValue('Kept');
  });

  test('Shift+Enter, or an Enter that ends an IME composition, stays in the title', async ({
    page,
  }) => {
    await startNote(page, 'Note');
    const title = page.getByRole('textbox', { name: 'Title' });
    await title.press('Shift+Enter');
    await title.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });

    await expect(title).toBeFocused();
  });

  test('Escape on the link popover goes back to the text', async ({ page, isMobile }) => {
    test.skip(isMobile, "a phone's media family is collapsed, so mod+K prompts instead");
    await startNote(page, 'Note');
    const body = page.locator('.tiptap');
    await body.click();
    await page.keyboard.type('a link');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('textbox', { name: 'Link URL' })).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('textbox', { name: 'Link URL' })).toBeHidden();
    await expect(body).toBeFocused();
  });

  test('Escape closes the slash menu and keeps the note open', async ({ page }) => {
    await startNote(page, 'Note');
    await page.locator('.tiptap').click();
    await page.keyboard.type('/');
    // The slash menu's rows are list items; the bar's own Heading 1 button is not.
    const heading = page.getByRole('listitem').getByRole('button', { name: 'Heading 1' });
    await expect(heading).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(heading).toBeHidden();
    await expect(page.locator('.tiptap')).toBeFocused();
  });
});

// iPadOS 12 says "iPad ... like Mac OS X": react-hotkeys-hook reads that as not a Mac, while the
// editor and the chip read it as one.
test.describe('an old iPad', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(`
      const ua = 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
      Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ua });
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'iPad' });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    `);
    await skipTour(page);
    await page.goto('/');
  });

  test('takes Cmd+K for search, as the editor takes Cmd for its keys', async ({ page }) => {
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.keyboard.press('Meta+k');

    await expect(page.getByRole('searchbox')).toBeFocused();
  });
});

test.describe('icon tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('focus handed back after a menu shows no tooltip', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the language menu is desktop chrome');
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('menuitem', { name: /English/ }).click();

    await expect(page.getByRole('button', { name: 'Language' })).toBeFocused();
    // Past the provider's open delay, so a late tooltip would be on screen by now.
    await page.waitForTimeout(1000);
    await expect(page.getByRole('tooltip', { name: 'Language' })).toHaveCount(0);
  });

  test('a keyboard user still gets the tooltip', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the language menu is desktop chrome');
    await page.getByRole('button', { name: 'Toggle theme' }).focus();
    await page.keyboard.press('Shift+Tab');

    await expect(page.getByRole('tooltip', { name: 'Language' })).toBeVisible();
  });
});
