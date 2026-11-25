import { expect, type Page, test } from '@playwright/test';
import { card, closeNote, PICTURE, skipTour, startNote } from './helpers';

async function openDrawing(page: Page) {
  await startNote(page, 'Drawing');
  await expect(page.locator('canvas.interactive')).toBeVisible();
}

async function drawRectangle(page: Page) {
  await page.locator('[data-testid="toolbar-rectangle"]').click({ force: true });
  const box = await page.locator('canvas.interactive').boundingBox();
  if (!box) throw new Error('no canvas');
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x - 40, y - 30);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 30, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
}

test.describe('the platform Back over an open Drawing', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('asks before discarding unsaved strokes', async ({ page }) => {
    await openDrawing(page);
    await drawRectangle(page);

    // A second Back while the question is up must not cost a second history entry.
    await page.goBack();
    const confirm = page.getByRole('dialog', { name: 'Discard drawing?' });
    await expect(confirm).toBeVisible();
    await page.goBack();
    await confirm.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByRole('dialog', { name: 'Drawing', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    await expect(page).toHaveURL(/[?&]note=/);

    await page.goBack();
    await confirm.getByRole('button', { name: 'Discard' }).click();
    await expect(page).not.toHaveURL(/[?&]note=/);
    await expect(page.locator('canvas.interactive')).toHaveCount(0);
  });

  test('a tab close over unsaved strokes gets the browser prompt', async ({ page }) => {
    // The router skips its own unload prompt after any Back of the app's, such as this close.
    await startNote(page, 'Note');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
    await closeNote(page);
    await openDrawing(page);
    await drawRectangle(page);

    const prompt = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    expect((await prompt).type()).toBe('beforeunload');
  });

  test('closes an untouched Drawing without asking', async ({ page }) => {
    await openDrawing(page);

    await page.goBack();
    await expect(page).not.toHaveURL(/[?&]note=/);
    await expect(page.getByRole('dialog', { name: 'Discard drawing?' })).toHaveCount(0);
  });

  test('stays out of the way of Save', async ({ page }) => {
    await openDrawing(page);
    await drawRectangle(page);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: /^Edit drawing, / })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Discard drawing?' })).toHaveCount(0);
    await expect(page).toHaveURL(/[?&]note=/);
  });
});

test('a picture inserted into a Drawing shows in its preview, in the Note and on the Card', async ({
  page,
}) => {
  // Without the File System Access picker, Excalidraw falls back to an `<input>` Playwright can fill.
  await page.addInitScript('delete window.showOpenFilePicker;');
  await skipTour(page);
  await page.goto('/');
  await openDrawing(page);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-testid="toolbar-image"]').click({ force: true });
  await (await chooser).setFiles(PICTURE);
  const box = await page.locator('canvas.interactive').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('button', { name: 'Save' }).click();

  const preview = page.getByRole('button', { name: 'Edit drawing' });
  await expect(preview.locator('use[href^="#image-"]')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Title' }).fill('Picture');
  await closeNote(page);
  await expect(card(page, 'Picture').locator('use[href^="#image-"]')).toHaveCount(1);
});
