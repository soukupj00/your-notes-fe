import { afterEach, describe, expect, it, vi } from 'vitest';

import { publishNavHeight } from './navHeight.ts';

describe('publishNavHeight', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the header border box height to --nav-height as it changes, and clears it', () => {
    let notify = () => {};
    const observe = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe = observe;
        disconnect = vi.fn();
      }
    );
    const header = document.createElement('header');
    let height = 60;
    header.getBoundingClientRect = () => ({ height }) as DOMRect;
    const root = document.documentElement.style;

    const cleanup = publishNavHeight(header);
    expect(observe).toHaveBeenCalledWith(header, { box: 'border-box' });
    notify();
    expect(root.getPropertyValue('--nav-height')).toBe('60px');

    height = 114;
    notify();
    expect(root.getPropertyValue('--nav-height')).toBe('114px');

    cleanup();
    expect(root.getPropertyValue('--nav-height')).toBe('');
  });
});
