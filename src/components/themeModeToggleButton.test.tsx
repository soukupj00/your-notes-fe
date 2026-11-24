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
  it('turns System on a dark OS light with one press', async () => {
    osPrefersDark(true);
    const button = renderToggle('system');
    expect(button.querySelector('.lucide-moon')).toBeInTheDocument();

    await userEvent.click(button);

    expect(document.documentElement).toHaveClass('light');
    expect(button.querySelector('.lucide-sun')).toBeInTheDocument();
  });
});
