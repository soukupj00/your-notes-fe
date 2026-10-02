import { useEffect } from 'react';

/**
 * Publishes how much of the layout viewport the software keyboard covers as `--keyboard-inset`.
 * iOS Safari ignores `interactive-widget=resizes-content`; why this is a CSS variable measured
 * from `visualViewport` is in CLAUDE.md, Nav shell.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const measure = () => {
      // `offsetTop` counts because iOS scrolls the page to keep the focused field in view.
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      // Clamped: mid-animation and rubber-band scrolls go negative. Rounded: sub-pixel steps
      // during the slide would restyle 60 times a second and move nothing.
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
