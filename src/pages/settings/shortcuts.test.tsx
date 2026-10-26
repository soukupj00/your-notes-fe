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

  it('renders on a coarse pointer after a reload in a tab that saw a hardware key', async () => {
    stubPointer(false);
    sessionStorage.setItem('hardware-key-seen', 'true');
    vi.resetModules();
    // The reload is a fresh module graph, so the provider has to come from it too.
    const { default: ReloadedPage } = await import('./shortcuts.tsx');
    const { PreferencesProvider: ReloadedProvider } = await import(
      '@/context/PreferencesProvider.tsx'
    );

    render(
      <ReloadedProvider>
        <ReloadedPage />
      </ReloadedProvider>
    );

    expect(screen.queryByText('redirected to /settings')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('settings.pages.shortcuts');
    sessionStorage.clear();
  });

  it('names itself once, in its heading', () => {
    stubPointer(true);
    mount();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('settings.pages.shortcuts');
    expect(screen.queryByText('settings.shortcuts.title')).toBeNull();
  });
});
