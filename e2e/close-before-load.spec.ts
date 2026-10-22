import { expect, test } from '@playwright/test';
import { card, closeNote, newTextNote, skipTour } from './helpers';

/**
 * Holds every read-only IndexedDB `get` of one Note until `__releaseHeldNote()`, so the editor
 * opens on a Note that has not loaded yet however fast the machine is. A string, not a function:
 * `tsconfig.node.json` has no DOM lib.
 */
const holdNoteReads = (id: string) => `{
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  window.__releaseHeldNote = () => release();
  const get = IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get = function (key) {
    const request = get.call(this, key);
    if (this.name !== 'notes' || key !== ${JSON.stringify(id)} || this.transaction.mode !== 'readonly') {
      return request;
    }
    let onsuccess = null;
    Object.defineProperty(request, 'onsuccess', { get: () => onsuccess, set: (h) => { onsuccess = h; } });
    request.addEventListener('success', (event) => {
      void released.then(() => onsuccess?.call(request, event));
    });
    return request;
  };
}`;

// A slow device opening a shared `?note=` link, and a user who leaves at once: the editor
// closes before the Note has loaded, while its fields are still blank.
test('a note closed before it loads is kept', async ({ page }) => {
  await skipTour(page);
  await page.goto('/');
  await newTextNote(page, 'Keep me', 'Body text');
  await card(page, 'Keep me').getByRole('heading', { name: 'Keep me' }).click();
  await expect(page).toHaveURL(/note=/);
  const link = page.url();
  const id = new URL(link).searchParams.get('note') ?? '';
  await closeNote(page);

  await page.addInitScript(holdNoteReads(id));
  await page.goto(link);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  await closeNote(page);
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate('window.__releaseHeldNote()');

  await page.goto('/');
  await expect(card(page, 'Keep me')).toHaveCount(1);
});
