import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import ToolbarSettingsPage from './toolbar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('the Editor toolbar page', () => {
  it('puts each part under its own section heading, one level below the page', () => {
    render(
      <PreferencesProvider>
        <ToolbarSettingsPage />
      </PreferencesProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('settings.pages.toolbar');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'settings.toolbar.preset.legend',
      'settings.toolbar.preview',
      'settings.toolbar.groups',
    ]);
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
  });

  // The phone's app bar carries Back; from `sm:` up this link is the only way up.
  it('links back up to the Settings home', () => {
    render(
      <PreferencesProvider>
        <ToolbarSettingsPage />
      </PreferencesProvider>
    );

    expect(screen.getByRole('link', { name: 'nav.settings' })).toHaveAttribute('href', '/settings');
  });
});
