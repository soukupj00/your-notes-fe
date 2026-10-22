import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { TourProvider } from '@/context/TourProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { clearStore, withStore } from '@/test/store.tsx';
import SettingsPage from './settings.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
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

// The page links out (`Link`) and `TourProvider` navigates (the three hooks); neither is what
// this file tests, so the router is stubbed.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ state: { location: { pathname: '/settings' } }, history: { back: vi.fn() } }),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { href: 'http://localhost/settings' } }),
}));

afterEach(async () => {
  document.documentElement.classList.remove('cvd');
  localStorage.clear();
  await clearStore();
});

const storedPrefs = async () =>
  JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null') as
    | Record<string, unknown>
    | undefined;

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
    expect(screen.getByText(/^settings\.toolbar\.width\.current\./)).toBeInTheDocument();
  });

  it('carries the quick-capture list and the note button side', async () => {
    mount();

    expect(await screen.findByText('settings.quickCapture.title')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'settings.quickCapture.alignment.left' })
    ).toBeInTheDocument();
  });
});

describe('the help section', () => {
  it('links out to the docs site and the repository', async () => {
    mount();

    expect(await screen.findByRole('link', { name: 'settings.help.docs.open' })).toHaveAttribute(
      'href',
      'https://soukupj00.github.io/your-notes-fe/'
    );
    expect(screen.getByRole('link', { name: 'settings.help.docs.github' })).toHaveAttribute(
      'href',
      'https://github.com/soukupj00/your-notes-fe'
    );
  });
});
