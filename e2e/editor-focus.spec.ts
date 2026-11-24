import { expect, type Page, test } from '@playwright/test';
import { closeNote, newTextNote, skipTour, startNote } from './helpers';

/**
 * Chrome's own tree, not Playwright's role queries, which apply aria-hidden themselves: Chrome
 * ignores an aria-hidden set while focus is under it, for the rest of the page load.
 */
async function exposedToChrome(page: Page, name: string) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  return nodes.some((node) => !node.ignored && node.name?.value === name);
}

test.describe('opening focus', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('a new note opens with the title focused', async ({ page }) => {
    await startNote(page, 'Note');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
  });

  // On a phone no field, so the software keyboard stays down, yet focus inside the dialog: left on
  // the Card, it sits under the modal's aria-hidden, where a screen reader never hears the dialog.
  test('an existing note opens with its heading focused on a phone, and the title focused on a desktop', async ({
    page,
    isMobile,
  }) => {
    await newTextNote(page, 'Kept', 'some text');
    await page.getByRole('heading', { name: 'Kept' }).click();

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect(title).toHaveValue('Kept');
    if (isMobile) {
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'Edit note' })
      ).toBeFocused();
    } else {
      await expect(title).toBeFocused();
    }
  });

  // After a reload the first open goes through the loading fallback, the second through the
  // editor alone; either one leaving focus on the Card would leave the feed exposed from then on.
  test('an opened note hides the feed from Chrome, cold and warm', async ({ page }) => {
    await newTextNote(page, 'Kept');
    await page.reload();

    for (const open of ['cold', 'warm']) {
      const kept = page.getByRole('heading', { name: 'Kept' });
      await kept.waitFor();
      expect(await exposedToChrome(page, 'Toggle navigation'), open).toBe(true);
      await kept.click();
      await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Kept');
      await expect.poll(() => exposedToChrome(page, 'Toggle navigation'), open).toBe(false);
      await closeNote(page);
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

  test('a press on a slash menu row runs it', async ({ page, isMobile }) => {
    await startNote(page, 'Note');
    const body = page.locator('.tiptap');
    await body.click();
    await page.keyboard.type('/');
    const heading = page.getByRole('listitem').getByRole('button', { name: 'Heading 1' });

    if (isMobile) await heading.tap();
    else await heading.click();

    await expect(heading).toBeHidden();
    await expect(body.locator('h1')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
  });

  test('the slash menu stays on screen at the bottom of a long note', async ({ page }) => {
    await startNote(page, 'Note');
    await page.locator('.tiptap').click();
    for (let line = 0; line < 40; line++) await page.keyboard.type(`line ${line}\n`);
    await page.keyboard.type('/');
    const menu = page.getByRole('list').filter({ hasText: 'Heading 1' });

    await expect(menu).toBeInViewport({ ratio: 1 });

    await page.keyboard.type('h');

    await expect(menu).toBeInViewport({ ratio: 1 });
  });

  test('the slash menu follows the caret when the note scrolls', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the wheel is a mouse gesture');
    await startNote(page, 'Note');
    await page.locator('.tiptap').click();
    for (let line = 0; line < 40; line++) await page.keyboard.type(`line ${line}\n`);
    await page.keyboard.type('/');
    const menu = page.getByRole('list').filter({ hasText: 'Heading 1' });
    const caretLine = page.locator('.tiptap [data-decoration-id]');
    const gap = async () =>
      ((await caretLine.boundingBox())?.y ?? 0) - ((await menu.boundingBox())?.y ?? 0);
    await expect(menu).toBeInViewport({ ratio: 1 });
    const before = await gap();

    await page.getByRole('textbox', { name: 'Title' }).hover();
    await page.mouse.wheel(0, -120);

    await expect(caretLine).not.toBeInViewport();
    await expect.poll(gap).toBeCloseTo(before, 0);
  });
});

// iPadOS 12 says "iPad ... like Mac OS X": a library reading it as no Mac would split search from the
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

test.describe('the empty body', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  // A string: `tsconfig.node.json` has no DOM lib (see `skipTour`).
  const drawnHint = (page: Page) =>
    page.evaluate(
      `getComputedStyle(document.querySelector('[role="dialog"] .tiptap p'), '::before').content`
    );

  // Playwright, not Vitest: jsdom applies no stylesheet, and the hint is drawn by one.
  test('draws its hint until the first character', async ({ page }) => {
    const hint = "Write something, or press '/' for commands…";
    await startNote(page, 'Note');
    const body = page.locator('.tiptap');
    await body.locator('p').first().waitFor();

    await expect.poll(() => drawnHint(page)).toContain(hint);
    await expect(body).toHaveAttribute('aria-placeholder', hint);

    await body.click();
    await page.keyboard.type('a');
    await expect.poll(() => drawnHint(page)).toBe('none');
    await expect(body).not.toHaveAttribute('aria-placeholder');
  });

  test('keeps its hint off blank lines and off a new Checklist', async ({ page }) => {
    await startNote(page, 'Note');
    const body = page.locator('.tiptap');
    await body.locator('p').first().waitFor();
    await body.click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');

    await expect.poll(() => drawnHint(page)).toBe('none');
    await expect(body).not.toHaveAttribute('aria-placeholder');

    await closeNote(page);
    await startNote(page, 'Checklist');
    await page.locator('.tiptap li').waitFor();
    await expect(page.locator('.tiptap')).not.toHaveAttribute('aria-placeholder');
  });
});
