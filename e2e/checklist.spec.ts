import { expect, test } from '@playwright/test';
import { closeNote, newTextNote, skipTour, startNote } from './helpers';

test.describe('checklist', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('a tap on the item text ticks it from the card', async ({ page }) => {
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('Milk');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bread');
    await page.getByRole('textbox', { name: 'Title' }).fill('Shopping');
    await closeNote(page);

    const card = page.getByRole('button', { name: /Shopping/ });
    // On the glyphs: the paragraph spans the row, and its centre is the empty
    // run after a short word, which is the card rather than the control.
    await card.getByText('Milk').click({ position: { x: 6, y: 8 } });

    await expect(card.locator('li[data-checked="true"]')).toHaveCount(1);
    // The card was not opened by the tap.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Past the end of the words the row is the card again.
    const bread = card.getByText('Bread');
    const box = await bread.boundingBox();
    if (!box) throw new Error('row not laid out');
    await bread.click({ position: { x: box.width - 6, y: 8 } });
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('the grip reorders an item, and the order is what is saved', async ({ page }) => {
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('One');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Two');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Three');
    await page.getByRole('textbox', { name: 'Title' }).fill('Order');

    // Through the list: the editor's node view builds the `li` without the
    // `data-type` the stored markup carries.
    const rows = page.locator('.tiptap ul[data-type="taskList"] > li');
    const first = rows.nth(0);
    await first.hover();
    const grip = first.getByRole('button', { name: 'Reorder item' });
    const gripBox = await grip.boundingBox();
    const lastBox = await rows.nth(2).boundingBox();
    if (!gripBox || !lastBox) throw new Error('rows not laid out');

    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(gripBox.x + gripBox.width / 2, lastBox.y + lastBox.height, { steps: 8 });
    await page.mouse.up();

    await expect(rows).toHaveText(['Two', 'Three', 'One']);

    await closeNote(page);
    const card = page.getByRole('button', { name: /Order/ });
    await expect(card.locator('li[data-type="taskItem"]')).toHaveText(['Two', 'Three', 'One']);
  });

  test('a long press on a card row opens the note', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'press-and-hold is a touch gesture');
    await newTextNote(page, 'Held');
    // Turn the note into a checklist so it has a row. Opened from its title:
    // the card's centre is its foot rail on a title-only card at this width.
    await page.getByRole('heading', { name: 'Held' }).click();
    await page.locator('.tiptap').click();
    await page.keyboard.press('Control+Shift+9');
    await page.keyboard.type('Item');
    await closeNote(page);

    const row = page.getByRole('button', { name: /Held/ }).locator('li[data-type="taskItem"]');
    const box = await row.boundingBox();
    if (!box) throw new Error('row not laid out');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await page.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(row.locator('..').locator('li[data-checked="true"]')).toHaveCount(0);
  });
});
