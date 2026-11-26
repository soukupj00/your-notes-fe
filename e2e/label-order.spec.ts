import { expect, type Page, test } from '@playwright/test';
import { skipTour } from './helpers.ts';

async function createLabels(page: Page, ...names: string[]) {
  for (const name of names) {
    await page.getByRole('textbox', { name: 'Label name' }).fill(name);
    await page.getByRole('button', { name: 'Create label' }).click();
    await expect(page.getByRole('textbox', { name: `Rename label ${name}` })).toBeVisible();
  }
}

const pageOrder = async (page: Page) =>
  Promise.all(
    (await page.getByRole('textbox', { name: /^Rename label / }).all()).map((field) =>
      field.inputValue()
    )
  );

async function expectSidebarOrder(page: Page, isMobile: boolean, names: string[]) {
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  const links = page
    .getByRole('navigation', { name: 'Main navigation' })
    .locator('a[href^="/tag/"]');
  await expect(links).toHaveText(names);
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(links.first()).toBeHidden();
  }
}

/**
 * The keyboard drag the handle announces: Space to lift, arrows to move, Space to drop. dnd-kit
 * listens for the arrows only from the task after the lift, so the spec waits one task too.
 */
async function moveUp(page: Page, name: string, steps: number) {
  const announced = (position: number) =>
    expect(page.locator('[id^="DndLiveRegion"]')).toHaveText(
      `${name} moved to position ${position}.`
    );
  const from = (await pageOrder(page)).indexOf(name) + 1;
  await page.getByRole('button', { name: `Move label ${name}` }).focus();
  await page.keyboard.press('Space');
  await announced(from);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve)));
  for (let step = 1; step <= steps; step++) {
    await page.keyboard.press('ArrowUp');
    await announced(from - step);
  }
  await page.keyboard.press('Space');
}

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await page.goto('/labels');
});

test('labels show A to Z until one is dragged, then in the dragged order everywhere', async ({
  page,
  isMobile,
}) => {
  await createLabels(page, 'Work', 'Ideas', 'Personal');
  expect(await pageOrder(page)).toEqual(['Ideas', 'Personal', 'Work']);
  await expectSidebarOrder(page, isMobile, ['Ideas', 'Personal', 'Work']);

  await moveUp(page, 'Work', 2);

  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);
  // The page shows the dropped order before the store's write lands, the sidebar only after it.
  await expectSidebarOrder(page, isMobile, ['Work', 'Ideas', 'Personal']);
  await page.reload();
  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);
  await expectSidebarOrder(page, isMobile, ['Work', 'Ideas', 'Personal']);
});

test('Arrange A to Z and Undo', async ({ page }) => {
  await createLabels(page, 'Work', 'Ideas', 'Personal');
  await moveUp(page, 'Work', 2);
  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);

  await page.getByRole('button', { name: 'Arrange labels' }).click();
  await page.getByRole('menuitem', { name: 'A to Z' }).click();

  await expect.poll(() => pageOrder(page)).toEqual(['Ideas', 'Personal', 'Work']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);
});

test('a new label in a custom order lands at its alphabetical place', async ({ page }) => {
  await createLabels(page, 'Work', 'Ideas', 'Personal');
  await moveUp(page, 'Work', 2);
  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);

  await createLabels(page, 'Groceries', 'Zoo');

  await expect
    .poll(() => pageOrder(page))
    .toEqual(['Groceries', 'Work', 'Ideas', 'Personal', 'Zoo']);
});

test('a dropped label settles into its new place without jumping past it', async ({ page }) => {
  await createLabels(page, 'Alpha', 'Beta', 'Delta', 'Gamma');
  await expect(page.locator('[data-just-created]')).toHaveCount(0);
  const handle = page.getByRole('button', { name: 'Move label Gamma' });
  const box = await handle.boundingBox();
  if (!box) throw new Error('no handle');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 20, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2, box.y - box.height * 2.5, { steps: 10 });
  await expect(page.locator('[id^="DndLiveRegion"]')).toHaveText('Gamma moved to position 2.');
  // Held still, as a person does before letting go: the rows it passed have finished sliding.
  await expect
    .poll(() =>
      page.evaluate('document.getAnimations().filter((a) => a instanceof CSSTransition).length')
    )
    .toBe(0);

  // Every frame after the drop, so a one-frame jump cannot hide between two polls.
  await page.evaluate(`window.__tops = [];
    (function sample() {
      const field = document.querySelector('[aria-label="Rename label Gamma"]');
      window.__tops.push(field.getBoundingClientRect().top);
      if (window.__tops.length < 20) requestAnimationFrame(sample);
    })();`);
  await page.mouse.up();
  await expect.poll(() => pageOrder(page)).toEqual(['Alpha', 'Gamma', 'Beta', 'Delta']);
  await expect.poll(() => page.evaluate('window.__tops.length')).toBe(20);

  const tops = (await page.evaluate('window.__tops')) as number[];
  const [held, settled] = [tops[0], tops[tops.length - 1]];
  expect(Math.min(...tops)).toBeGreaterThanOrEqual(Math.min(held, settled) - 2);
  expect(Math.max(...tops)).toBeLessThanOrEqual(Math.max(held, settled) + 2);
});

test('a row reached by Shift+Tab from below stops clear of the sticky navbar', async ({ page }) => {
  // A to Z: Alpha, Beta, Delta, then five rows, so Delta can be scrolled up to the navbar.
  await createLabels(page, 'Alpha', 'Beta', 'Delta', 'Epsilon', 'Eta', 'Gamma', 'Theta', 'Zeta');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  await page.setViewportSize({ width: viewport.width, height: 360 });

  // Inside `main`, so not a `banner` landmark; the page's one `header`.
  const navbar = page.locator('header');
  const barBottom = async () => {
    const box = await navbar.boundingBox();
    if (!box) throw new Error('no navbar');
    return box.y + box.height;
  };
  const delta = page.getByRole('button', { name: 'Move label Delta' });
  await delta.evaluate((element) => element.focus({ preventScroll: true }));
  const deltaBox = await delta.boundingBox();
  if (!deltaBox) throw new Error('no row');
  await page.evaluate(`scrollBy(0, ${deltaBox.y - (await barBottom()) - 4})`);
  // Beta's controls, the next stops back, now sit under the navbar.
  await expect
    .poll(async () => (await delta.boundingBox())?.y)
    .toBeLessThan((await barBottom()) + 8);

  await page.keyboard.press('Shift+Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveAccessibleName(/Beta$/);
  const box = await focused.boundingBox();
  if (!box) throw new Error('no focus');
  // The focus outline is drawn 4px outside the box.
  expect(box.y - 4).toBeGreaterThanOrEqual(await barBottom());
});
