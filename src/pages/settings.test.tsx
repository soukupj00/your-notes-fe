import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { TourProvider } from '@/context/TourProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { db } from '@/db/db.ts';
import { withStore } from '@/test/store.tsx';
import SettingsPage from './settings.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// LanguageSection reads i18n directly. The real module calls
// `initReactI18next`, which the mock above does not export, so it has to be
// stubbed too rather than left to load.
vi.mock('@/i18n', () => ({
  default: {
    options: { supportedLngs: ['en', 'cs'] },
    resolvedLanguage: 'en',
    changeLanguage: vi.fn(),
  },
}));

// `HelpSection` can start the Tour and the page links out to it; neither is
// what this file is about, and rendering either for real would drag in a router.
// The three hooks are `TourProvider`'s, which the mount below wraps the page in
// so the replay row has a Tour to ask about.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ state: { location: { pathname: '/settings' } }, history: { back: vi.fn() } }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { href: 'http://localhost/settings' } }),
}));

afterEach(async () => {
  document.documentElement.classList.remove('cvd');
  await db.settings.clear();
});

const storedPrefs = async () =>
  (await db.settings.get(PREFERENCES_KEY))?.value as Record<string, unknown> | undefined;

function mount() {
  return render(
    withStore(
      <ThemeProvider>
        <PreferencesProvider>
          <TourProvider>
            <SettingsPage />
          </TourProvider>
        </PreferencesProvider>
      </ThemeProvider>
    )
  );
}

describe('appearance settings', () => {
  it('persists the colour-blind palette toggle', async () => {
    mount();

    const toggle = await screen.findByRole('switch', { name: 'settings.colorBlind.label' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);

    await waitFor(async () => expect((await storedPrefs())?.colorBlind).toBe(true));
    // The switch reflects the stored blob through a live query, so it settles a
    // tick after the write rather than with it.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('turns the palette back off without disturbing the theme choice', async () => {
    mount();

    const toggle = await screen.findByRole('switch', { name: 'settings.colorBlind.label' });
    await userEvent.click(toggle);
    await waitFor(async () => expect((await storedPrefs())?.colorBlind).toBe(true));

    await userEvent.click(toggle);

    await waitFor(async () => expect((await storedPrefs())?.colorBlind).toBe(false));
    // Theme is a separate store, which is the point of making the palette a
    // modifier: toggling it must never write a theme, and must never take one
    // away either.
    expect(await storedPrefs()).not.toHaveProperty('theme');
  });
});

describe('the customisation sections', () => {
  it('carries the toolbar editor, with the preview Settings has no live bar for', async () => {
    mount();

    expect(await screen.findByTestId('toolbar-preview')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'settings.toolbar.width.compact' })
    ).toBeInTheDocument();
  });

  it('carries the quick-capture list and the note button side', async () => {
    mount();

    expect(await screen.findByText('settings.quickCapture.title')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'settings.quickCapture.alignment.left' })
    ).toBeInTheDocument();
  });
});
