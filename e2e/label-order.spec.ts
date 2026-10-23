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

/** The sidebar's labels, opening the drawer first on a phone. */
async function sidebarOrder(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  const links = page
    .getByRole('navigation', { name: 'Main navigation' })
    .locator('a[href^="/tag/"]');
  await links.first().waitFor();
  const names = await links.allInnerTexts();
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(links.first()).toBeHidden();
  }
  return names;
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
  expect(await sidebarOrder(page, isMobile)).toEqual(['Ideas', 'Personal', 'Work']);

  await moveUp(page, 'Work', 2);

  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);
  expect(await sidebarOrder(page, isMobile)).toEqual(['Work', 'Ideas', 'Personal']);
  await page.reload();
  await expect.poll(() => pageOrder(page)).toEqual(['Work', 'Ideas', 'Personal']);
  expect(await sidebarOrder(page, isMobile)).toEqual(['Work', 'Ideas', 'Personal']);
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
