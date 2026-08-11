import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Testing Library gives `findBy*` and `waitFor` one second, which is generous
// for a component and not generous at all for the handful of tests that render
// the whole app: a route render here pulls a lazy chunk, opens Dexie and waits
// on a live query, and 125 test files run in parallel on however many cores the
// machine has. Those tests passed alone and failed perhaps one run in three
// under load - a timeout, never a wrong assertion.
//
// Raising the budget costs nothing a passing test can feel, since these are
// polls that resolve as soon as the condition holds; what it buys is that a red
// suite means something is broken. A test that genuinely hangs still fails, five
// seconds later.
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
