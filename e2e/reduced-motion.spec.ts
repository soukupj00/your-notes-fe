import { expect, type Page, test } from '@playwright/test';
import { skipTour, startNote } from './helpers.ts';

type Stored = 'system' | 'always' | 'never';

async function preferMotion(page: Page, os: 'reduce' | 'no-preference', stored: Stored) {
  await page.emulateMedia({ reducedMotion: os });
  await skipTour(page);
  await page.addInitScript(`
    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{"version":2}');
    localStorage.setItem('preferences', JSON.stringify({ ...stored, reducedMotion: '${stored}' }));
  `);
}

// Strings, not functions: `tsconfig.node.json` has no DOM lib.
const LASTS = `(durations) => durations.split(',').some((duration) => parseFloat(duration) > 0.001)`;

/** Every element or pseudo-element whose animation or transition still takes time, spinners aside. */
const moving = (page: Page) =>
  page.evaluate(`[...document.querySelectorAll('*')]
    .filter((el) => !el.matches('.animate-spin, .excalidraw .Spinner *'))
    .flatMap((el) => [null, '::before', '::after'].map((pseudo) => [el, pseudo]))
    .filter(([el, pseudo]) => {
      const style = getComputedStyle(el, pseudo);
      return (style.animationName !== 'none' && (${LASTS})(style.animationDuration)) ||
        (${LASTS})(style.transitionDuration);
    })
    .map(([el, pseudo]) => (el.dataset.slot ?? el.tagName.toLowerCase()) + (pseudo ?? ''))`) as Promise<
    string[]
  >;

const animationOf = (page: Page, selector: string) =>
  page.evaluate(`(() => {
    const style = getComputedStyle(document.querySelector('${selector}'));
    return {
      name: style.animationName,
      lasts: (${LASTS})(style.animationDuration),
      delay: style.animationDelay,
      iterations: style.animationIterationCount,
    };
  })()`) as Promise<{ name: string; lasts: boolean; delay: string; iterations: string }>;

test.describe('Reduce animations ends every animation and transition at once', () => {
  for (const [os, stored] of [
    ['reduce', 'system'],
    ['no-preference', 'always'],
  ] as const) {
    test(`with the OS set to ${os} and the Preference ${stored}`, async ({ page }) => {
      await preferMotion(page, os, stored);
      await page.goto('/');
      // A Checklist, for the sink divider's transition on a pseudo-element.
      await startNote(page, 'Checklist');
      await expect(page.locator('.tiptap ul[data-type="taskList"]')).toBeVisible();

      expect(await moving(page)).toEqual([]);
    });
  }
});

test.describe('motion stays', () => {
  for (const [os, stored] of [
    ['reduce', 'never'],
    ['no-preference', 'system'],
  ] as const) {
    test(`with the OS set to ${os} and the Preference ${stored}`, async ({ page }) => {
      await preferMotion(page, os, stored);
      await page.goto('/');
      await startNote(page, 'Note');
      await expect(page.getByRole('dialog')).toBeVisible();

      expect((await animationOf(page, '[role="dialog"]')).lasts).toBe(true);
    });
  }
});

test('the spinner turns and the late loading line still waits', async ({ page }) => {
  await preferMotion(page, 'no-preference', 'always');
  await page.goto('/');
  await page.evaluate(`for (const name of ['animate-spin', 'appear-late']) {
    const el = document.createElement('div');
    el.className = name;
    document.body.append(el);
  }`);

  expect(await animationOf(page, 'body > .animate-spin')).toMatchObject({
    name: 'spin',
    lasts: true,
    iterations: 'infinite',
  });
  expect(await animationOf(page, 'body > .appear-late')).toMatchObject({
    name: 'appear-late',
    delay: '0.5s',
  });
});

// Excalidraw starts a dialog's content transparent and lets its entrance reveal it.
test("a Drawing's own dialogs still show", async ({ page }) => {
  await preferMotion(page, 'no-preference', 'always');
  await page.goto('/');
  await startNote(page, 'Drawing');
  await page.getByTestId('main-menu-trigger').click();
  await page.getByTestId('clear-canvas-button').click();

  await expect(page.locator('.excalidraw .Modal__content')).toHaveCSS('opacity', '1');
});

// A scroll-driven fade follows the finger, not the clock, so it is not motion.
test('the label row still fades the edge labels hide past', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the fade exists only on the phone');
  await preferMotion(page, 'no-preference', 'always');
  await page.goto('/');
  const fades = await page.evaluate(`(async () => {
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.style.cssText = 'overflow-x: auto; white-space: nowrap; width: 300px';
    row.textContent = 'label '.repeat(200);
    document.body.prepend(row);
    const frames = () => new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)));
    const fades = () => ['start', 'end'].map((edge) => getComputedStyle(row).getPropertyValue('--filter-fade-' + edge));
    await frames();
    const atStart = fades();
    row.scrollLeft = (row.scrollWidth - row.clientWidth) / 2;
    await frames();
    return { atStart, midway: fades() };
  })()`);

  expect(fades).toEqual({ atStart: ['0px', '40px'], midway: ['40px', '40px'] });
});
