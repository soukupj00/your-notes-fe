import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './themeProvider.tsx';

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

    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement).toHaveClass('light');

    prefersDark = true;
    act(() => {
      mediaQuery.dispatchEvent(new Event('change'));
    });

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  // This tag is the only way to colour the system chrome at runtime: the manifest's colour is
  // fixed at build time.
  it('hands the resolved background to the platform as theme-color', () => {
    document.documentElement.style.setProperty('--background', 'oklch(17% 0.012 265)');

    render(<ThemeProvider defaultTheme="dark">content</ThemeProvider>);

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      'oklch(17% 0.012 265)'
    );
  });
});
