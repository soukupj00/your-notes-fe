import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { ThemeModeToggleButton } from './themeModeToggleButton.tsx';

function osPrefersDark(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: dark && query.includes('prefers-color-scheme: dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

function renderToggle(stored: string) {
  localStorage.setItem('vite-ui-theme', stored);
  render(
    <ThemeProvider>
      <ThemeModeToggleButton />
    </ThemeProvider>
  );
  return screen.getByRole('button', { name: 'settings.theme.toggle' });
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
  vi.restoreAllMocks();
});

describe('ThemeModeToggleButton', () => {
  it.each<{ os: string; stored: string; shown: 'dark' | 'light'; next: string }>([
    { os: 'dark', stored: 'system', shown: 'dark', next: 'light' },
    { os: 'light', stored: 'system', shown: 'light', next: 'dark' },
    { os: 'dark', stored: 'light', shown: 'light', next: 'system' },
    { os: 'light', stored: 'dark', shown: 'dark', next: 'system' },
  ])('flips $stored on a $os OS to $next', async ({ os, stored, shown, next }) => {
    const flipped = shown === 'dark' ? 'light' : 'dark';
    const icon = { dark: '.lucide-moon', light: '.lucide-sun' };
    osPrefersDark(os === 'dark');
    const button = renderToggle(stored);
    expect(button.querySelector(icon[shown])).toBeInTheDocument();

    await userEvent.click(button);

    expect(localStorage.getItem('vite-ui-theme')).toBe(next);
    expect(document.documentElement).toHaveClass(flipped);
    expect(button.querySelector(icon[flipped])).toBeInTheDocument();
  });
});
