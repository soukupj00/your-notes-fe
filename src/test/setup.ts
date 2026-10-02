import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// The default one second flaked the whole-app tests under parallel load (a timeout, never a
// wrong assertion). These are polls that resolve as soon as they hold, so a passing test does
// not pay for the bigger budget.
configure({ asyncUtilTimeout: 5000 });

// Stable browser API shims shared by Radix-based component tests.
if (typeof Element !== 'undefined' && typeof window !== 'undefined') {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  window.matchMedia ??= vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  // jsdom has no layout, so it ships no ResizeObserver. A no-op keeps components
  // that watch their own size (the toolbar's edge fade) mountable; anything that
  // needs real measurements belongs in a manual pass, not here.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// React Testing Library does not auto-clean between tests under Vitest globals,
// so unmount and remove rendered trees after every test to avoid cross-test leakage.
afterEach(() => {
  cleanup();
});
