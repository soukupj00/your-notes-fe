import { expect, type Locator, test } from '@playwright/test';
import { PICTURE, skipTour, startNote } from './helpers';

/**
 * WCAG contrast of an element's colour against its fill, both resolved to sRGB by a canvas.
 * Reached through `ownerDocument`, since this folder is type-checked without the DOM library.
 */
function contrastAgainstFill(locator: Locator) {
  return locator.evaluate((element) => {
    const document = element.ownerDocument;
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!canvas) throw new Error('no 2d canvas');
    const luminance = (css: string) => {
      canvas.fillStyle = '#010203';
      canvas.fillStyle = css;
      if (canvas.fillStyle === '#010203') throw new Error(`the canvas cannot read ${css}`);
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = canvas.getImageData(0, 0, 1, 1).data;
      if (alpha !== 255) throw new Error(`${css} is not opaque, so it mixes with what is behind`);
      const [lr, lg, lb] = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const style = document.defaultView?.getComputedStyle(element);
    if (!style) throw new Error('no window');
    const [light, dark] = [luminance(style.color), luminance(style.backgroundColor)].sort(
      (x, y) => y - x
    );
    return (light + 0.05) / (dark + 0.05);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`in the ${theme} theme the delete icon over a picture reads against its disc`, async ({
    page,
  }) => {
    await skipTour(page);
    await page.addInitScript(`localStorage.setItem('vite-ui-theme', '${theme}')`);
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Image');
    await (await chooser).setFiles(PICTURE);

    const remove = page.getByRole('dialog').getByRole('button', { name: 'Delete dot.png' });
    await expect(remove).toBeVisible();

    expect(await contrastAgainstFill(remove)).toBeGreaterThanOrEqual(3);
  });
}
