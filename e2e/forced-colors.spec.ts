import { expect, type Locator, type Page, test } from '@playwright/test';
import { skipTour } from './helpers';

/**
 * Forced colours (Windows High Contrast) paints every background as Canvas and drops every
 * box-shadow, so a state shown by a fill alone has to be repainted in system colours.
 * Colours are read from pixels: the computed background keeps the author's alpha, so a
 * transparent segment and a filled one differ there and still paint alike.
 */
async function paintedAt(page: Page, x: number, y: number) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  // A string, not a function: `tsconfig.node.json` has no DOM lib.
  return page.evaluate(`(async () => {
    const response = await fetch('data:image/png;base64,${png.toString('base64')}');
    const image = await createImageBitmap(await response.blob());
    const context = new OffscreenCanvas(image.width, image.height).getContext('2d');
    context.drawImage(image, 0, 0);
    const pixel = context.getImageData(image.width >> 1, image.height >> 1, 1, 1).data;
    return pixel.slice(0, 3).join();
  })()`) as Promise<string>;
}

/** Where `target` rests once a drawer's slide or a menu's zoom has finished. */
async function settledBox(target: Locator) {
  await target.scrollIntoViewIfNeeded();
  // Scroll-driven and endless animations never finish, so only the time-bound ones are awaited.
  await target.page().waitForFunction(`document.getAnimations().every((animation) =>
    animation.timeline !== document.timeline ||
    animation.effect?.getComputedTiming().iterations === Infinity)`);
  return target.boundingBox();
}

/** Just inside the top edge, where every control here shows its fill and no text. */
async function fillOf(target: Locator) {
  const box = await settledBox(target);
  if (!box) throw new Error('not on screen');
  return paintedAt(target.page(), box.x + box.width / 2, box.y + 3);
}

async function expectStandsOut(chosen: Locator, other: Locator) {
  expect(await fillOf(chosen)).not.toBe(await fillOf(other));
}

async function openNav(page: Page, isMobile: boolean) {
  if (isMobile) await page.locator('header [data-sidebar="trigger"]:visible').click();
  return page.getByRole('navigation', { name: 'Main navigation' });
}

// `test.use({ forcedColors })` is silently ignored as a fixture option; emulating works.
test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.emulateMedia({ forcedColors: 'active' });
});

test('the active destination stands out from the others', async ({ page, isMobile }) => {
  await page.goto('/');
  const nav = await openNav(page, isMobile);

  await expectStandsOut(
    nav.getByRole('link', { name: 'Notes' }),
    nav.getByRole('link', { name: 'Archive' })
  );
});

test('the chosen segment and the chosen tile stand out', async ({ page }) => {
  await page.goto('/settings/general');
  const theme = page.getByRole('radiogroup', { name: 'Theme' });
  const density = page.getByRole('radiogroup', { name: 'Density' });

  await expectStandsOut(
    theme.getByRole('radio', { checked: true }),
    theme.getByRole('radio', { checked: false }).first()
  );
  await expectStandsOut(
    density.locator('label', { has: page.getByRole('radio', { checked: true }) }),
    density.locator('label', { has: page.getByRole('radio', { checked: false }) })
  );
});

test('a switch shows its thumb, and on stands out from off', async ({ page }) => {
  await page.goto('/settings/general');
  const off = page.getByRole('switch', { name: 'Colour-blind palette' });
  const on = page.getByRole('switch', { name: 'Checked items move to the bottom of the list' });
  await expect(off).not.toBeChecked();
  await expect(on).toBeChecked();

  const thumbAndTrack = async (control: Locator) => {
    const track = await settledBox(control);
    const thumb = await control.locator('span').boundingBox();
    if (!thumb || !track) throw new Error('not on screen');
    const thumbOnLeft = thumb.x + thumb.width / 2 < track.x + track.width / 2;
    const y = track.y + track.height / 2;
    return [
      await paintedAt(page, thumb.x + thumb.width / 2, y),
      await paintedAt(page, track.x + track.width * (thumbOnLeft ? 0.75 : 0.25), y),
    ];
  };
  const [offThumb, offTrack] = await thumbAndTrack(off);
  const [onThumb, onTrack] = await thumbAndTrack(on);

  expect(offThumb).not.toBe(offTrack);
  expect(onThumb).not.toBe(onTrack);
  expect(onTrack).not.toBe(offTrack);
});

test('the highlighted row of a menu stands out', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the Language menu is in the header from `sm:` up; the rows are the same');
  await page.goto('/');
  await page.locator('header').getByRole('button', { name: 'Language' }).click();
  await page.keyboard.press('ArrowDown');
  const rows = page.getByRole('menu').locator('[role^="menuitem"]');

  await expectStandsOut(
    rows.and(page.locator('[data-highlighted]')),
    rows.and(page.locator(':not([data-highlighted])')).first()
  );
});
