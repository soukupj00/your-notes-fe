import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './themeProvider.tsx';

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.style.removeProperty('--background');
  document.querySelector('meta[name="theme-color"]')?.remove();
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('updates the active theme when the system color scheme changes', () => {
    let prefersDark = false;
    const mediaQuery = new EventTarget() as MediaQueryList;
    Object.defineProperties(mediaQuery, {
      matches: { get: () => prefersDark },
      media: { value: '(prefers-color-scheme: dark)' },
      onchange: { value: null, writable: true },
    });
    mediaQuery.addListener = vi.fn();
    mediaQuery.removeListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery);
    localStorage.setItem('vite-ui-theme', 'system');

    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement).toHaveClass('light');

    prefersDark = true;
    act(() => {
      mediaQuery.dispatchEvent(new Event('change'));
    });

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('resolves System to the OS scheme for its readers', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    localStorage.setItem('vite-ui-theme', 'system');
    function ResolvedTheme() {
      return useTheme().resolvedTheme;
    }

    render(
      <ThemeProvider>
        <ResolvedTheme />
      </ThemeProvider>
    );

    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  // This tag is the only way to colour the system chrome at runtime: the manifest's colour is
  // fixed at build time.
  it('hands the resolved background to the platform as theme-color', () => {
    document.documentElement.style.setProperty('--background', 'oklch(17% 0.012 265)');

    render(<ThemeProvider>content</ThemeProvider>);

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      'oklch(17% 0.012 265)'
    );
  });

  // An installed app and a browser tab of the same origin share the key but not the React state.
  it.each([
    ['takes a theme another window chose', 'vite-ui-theme', 'dark', 'dark'],
    ['falls back to the default when another window clears storage', null, null, 'dark'],
    ["ignores another window's other keys", 'preferences', 'dark', 'light'],
  ])('%s', (_, key, stored, expected) => {
    localStorage.setItem('vite-ui-theme', 'light');
    render(<ThemeProvider>content</ThemeProvider>);

    act(() => {
      if (key === null) localStorage.clear();
      else localStorage.setItem(key, stored ?? '');
      window.dispatchEvent(new StorageEvent('storage', { key }));
    });

    expect(document.documentElement).toHaveClass(expected);
  });
});
