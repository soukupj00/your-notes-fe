import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import ShortcutsSettingsPage from './shortcuts.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: ({ to }: { to: string }) => <p>redirected to {to}</p>,
}));

function stubPointer(fine: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('pointer: fine') ? fine : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

afterEach(() => vi.restoreAllMocks());

function mount() {
  render(
    <PreferencesProvider>
      <ShortcutsSettingsPage />
    </PreferencesProvider>
  );
}

describe('the Keyboard shortcuts page', () => {
  // A phone has no modifier keys, and a cold entry there would be a heading over nothing.
  it('sends a coarse pointer to the Settings home', () => {
    stubPointer(false);
    mount();

    expect(screen.getByText('redirected to /settings')).toBeInTheDocument();
  });

  it('names itself once, in its heading', () => {
    stubPointer(true);
    mount();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('settings.pages.shortcuts');
    expect(screen.queryByText('settings.shortcuts.title')).toBeNull();
  });
});
