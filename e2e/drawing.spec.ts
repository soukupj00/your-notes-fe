import { expect, type Page, test } from '@playwright/test';
import { card, closeNote, PICTURE, skipTour, startNote } from './helpers';

/** Every Drawing preview in the Local Store. */
const PREVIEWS = `new Promise((resolve) => {
  const open = indexedDB.open('NotesDB');
  open.onsuccess = () => {
    const read = open.result.transaction('attachments').objectStore('attachments').getAll();
    read.onsuccess = () => resolve(read.result.map((row) => row.preview).filter(Boolean));
  };
})`;

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

test.describe("Excalidraw's own dialogs over a Drawing", () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
    await openDrawing(page);
  });

  test('Help closes from its own control and from Escape', async ({ page }) => {
    const help = page.locator('.HelpDialog');
    const openHelp = async () => {
      await page.getByTestId('main-menu-trigger').click();
      await page.locator('.dropdown-menu-item', { hasText: 'Help' }).click();
      await expect(help).toBeVisible();
    };

    await openHelp();
    // A phone's dialogs fill the screen and carry a close button; elsewhere a click beside one closes it.
    const close = page.locator('.Dialog__close');
    if (await close.isVisible()) await close.click();
    else await page.locator('.Modal__background').click({ position: { x: 5, y: 5 } });
    await expect(help).toBeHidden();

    await openHelp();
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
  });

  test('Reset the canvas can be cancelled, keeping the shape', async ({ page }) => {
    await drawRectangle(page);
    await page.getByTestId('main-menu-trigger').click();
    await page.getByText('Reset the canvas').click();
    const confirm = page.locator('.confirm-dialog');
    await expect(confirm).toBeVisible();

    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  });

  test('the Mermaid tool takes a definition and inserts that diagram', async ({ page }) => {
    await page.getByRole('button', { name: 'More tools' }).click();
    await page.locator('.dropdown-menu-item', { hasText: 'Mermaid to Excalidraw' }).click();
    const preview = page.locator('.ttd-dialog-output-canvas-container canvas');
    await expect(preview).toBeVisible();
    // Each render replaces the canvas, so a canvas without the mark is the typed definition's.
    await preview.evaluate((canvas) => canvas.setAttribute('data-sample', ''));

    await page.locator('.ttd-dialog textarea').fill('flowchart LR\n  Typed --> Here');
    await expect(preview.and(page.locator(':not([data-sample])'))).toBeVisible();
    await page.locator('.ttd-dialog').getByRole('button', { name: 'Insert' }).click();
    await expect(page.locator('.ttd-dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Edit drawing' })).toBeVisible();
    const [saved] = (await page.evaluate(PREVIEWS)) as string[];
    expect(saved).toContain('Typed');
    expect(saved).toContain('Here');
  });
});
