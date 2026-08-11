import { useEffect } from 'react';

/**
 * How much of the layout viewport the software keyboard is covering, published
 * as `--keyboard-inset` on `<html>`.
 *
 * ## Why this exists when `interactive-widget` already did the job
 *
 * `index.html` carries `interactive-widget=resizes-content`, which asks the
 * browser to shrink the *layout* viewport when the keyboard opens - so `100dvh`
 * ends at the keyboard and a bar pinned to the bottom of a full-height sheet
 * lands on top of it. Chrome on Android honours that. **iOS Safari does not**:
 * there the layout viewport keeps its full height, the keyboard is drawn over
 * the page, and the same pinned bar sits behind it.
 *
 * `window.visualViewport` reports the truth on both, so this is one mechanism
 * rather than a platform branch. It also self-neutralises where it is not
 * needed: on Android `innerHeight` has already shrunk to match, so the
 * subtraction yields ~0 and the variable costs nothing.
 *
 * `offsetTop` is part of the sum because iOS *scrolls the page* to keep the
 * focused field visible rather than only shrinking the visible area, so the
 * visual viewport's origin moves as well as its height.
 *
 * ## Contract
 *
 * A single global variable rather than per-component state, because the thing
 * being described is global - there is one keyboard - and because the consumers
 * are CSS lengths (`padding-bottom`, `height`), which is a place React state
 * cannot reach without re-rendering an editor on every frame of the keyboard's
 * animation.
 *
 * Rounded to whole pixels: the raw value lands on fractions during the slide,
 * and a variable that changes 60 times a second by a quarter of a pixel is 60
 * style recalculations that move nothing.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const measure = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      // Negative is possible mid-animation and on a rubber-banded scroll; it
      // would read as the sheet owing the keyboard height back.
      const inset = Math.max(0, Math.round(covered));
      root.style.setProperty('--keyboard-inset', `${inset}px`);
    };

    measure();
    viewport.addEventListener('resize', measure);
    viewport.addEventListener('scroll', measure);
    return () => {
      viewport.removeEventListener('resize', measure);
      viewport.removeEventListener('scroll', measure);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
