import { expect, type Page, test } from '@playwright/test';
import { skipTour } from './helpers.ts';

const LABELS = [
  'Groceries',
  'Work',
  'Recipes',
  'Travel',
  'Books to read',
  'Ideas',
  'Family',
  'Garden',
  'Fitness',
  'Finance',
  'Movies',
  'Home repairs',
  'Gifts',
  'Music',
  'Projects',
  'Health',
  'Car',
  'Kids',
  'School',
  'Zettelkasten',
  'A label name far too long to fit across a phone screen',
];

async function createLabels(page: Page) {
  await page.goto('/labels');
  for (const name of LABELS) {
    await page.getByRole('textbox', { name: 'Label name' }).fill(name);
    await page.getByRole('button', { name: 'Create label' }).click();
    await expect(page.getByRole('textbox', { name: `Rename label ${name}` })).toBeVisible();
  }
}

const filterList = (page: Page) => page.getByRole('list', { name: 'Filter by label' });
const pill = (page: Page, name: string) => filterList(page).getByRole('button', { name });

test.beforeEach(async ({ page }) => {
  await skipTour(page);
  await createLabels(page);
  await page.goto('/?q=a');
  await expect(filterList(page)).toBeVisible();
});

test.describe('on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'the single row is the narrow layout');

  test('the label filter is one row that scrolls sideways', async ({ page }) => {
    const list = filterList(page);
    const first = await pill(page, LABELS[0]).boundingBox();
    const last = await pill(page, 'Zettelkasten').boundingBox();
    expect(last?.y).toBe(first?.y);
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const widest = await list.evaluate((el) =>
      Math.max(...[...el.querySelectorAll('button')].map((button) => button.offsetWidth))
    );
    expect(widest).toBeLessThanOrEqual(await list.evaluate((el) => el.clientWidth));
  });

  test('a selected label at the end of the row is scrolled into view on arrival', async ({
    page,
  }) => {
    const last = pill(page, 'Zettelkasten');
    await last.click();
    await expect(last).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    await expect(last).toBeInViewport({ ratio: 1 });
  });
});

test.describe('on a desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'wrapping is the wide layout');

  test('the label filter wraps onto more rows', async ({ page }) => {
    const first = await pill(page, LABELS[0]).boundingBox();
    const last = await pill(page, 'Zettelkasten').boundingBox();
    expect(last?.y).toBeGreaterThan(first?.y ?? 0);
  });
});
