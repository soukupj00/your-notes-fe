import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bootScript from '../../public/theme-boot.js?raw';
import { ThemeProvider } from './themeProvider.tsx';

const root = document.documentElement;
const runBootScript = new Function(bootScript) as () => void;

beforeEach(() => {
  document.head.append(
    Object.assign(document.createElement('meta'), { name: 'color-scheme', content: 'light dark' })
  );
});

afterEach(() => {
  localStorage.clear();
  root.className = '';
  document.querySelector('meta[name="color-scheme"]')?.remove();
  vi.restoreAllMocks();
});

// The boot script paints the frames before the app mounts and the provider every frame after,
// so the two must resolve every stored value alike.
describe('theme-boot.js', () => {
  it.each([
    { stored: null, os: 'light', shows: 'dark' },
    { stored: 'dark', os: 'light', shows: 'dark' },
    { stored: 'light', os: 'dark', shows: 'light' },
    { stored: 'system', os: 'dark', shows: 'dark' },
    { stored: 'system', os: 'light', shows: 'light' },
    { stored: 'blue', os: 'light', shows: 'dark' },
    { stored: 'blocked', os: 'light', shows: 'dark' },
  ])('shows $shows for $stored on a $os OS, as ThemeProvider does', ({ stored, os, shows }) => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: os === 'dark',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    if (stored === 'blocked') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });
    } else if (stored !== null) {
      localStorage.setItem('vite-ui-theme', stored);
    }

    runBootScript();
    expect(root.className).toBe(shows);
    expect(document.querySelector('meta[name="color-scheme"]')).toHaveAttribute('content', shows);

    root.className = '';
    render(<ThemeProvider>content</ThemeProvider>);
    expect(root.className).toBe(shows);
  });
});
