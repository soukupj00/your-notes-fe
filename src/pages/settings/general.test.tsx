import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { clearStore, withStore } from '@/test/store.tsx';
import GeneralSettingsPage from './general.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// LanguageSection reads i18n directly. The real module calls `initReactI18next`, which the mock
// above does not export, so it is stubbed too rather than left to load.
vi.mock('@/i18n', () => ({
  default: {
    options: { supportedLngs: ['en', 'cs'] },
    resolvedLanguage: 'en',
    changeLanguage: vi.fn(),
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

afterEach(async () => {
  document.documentElement.classList.remove('cvd');
  localStorage.clear();
  await clearStore();
});

const storedPrefs = () =>
  JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null') as
    | Record<string, unknown>
    | undefined;

function mount() {
  return render(
    withStore(
      <ThemeProvider>
        <PreferencesProvider>
          <GeneralSettingsPage />
        </PreferencesProvider>
      </ThemeProvider>
    )
  );
}

describe('the General page', () => {
  it('has the language and theme, display and checklist sections, in order', async () => {
    mount();

    expect((await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent)).toEqual(
      [
        'settings.general.languageAndTheme',
        'settings.general.display',
        'settings.general.checklists',
      ]
    );
  });

  it('names the checklist switch by what it does and gives it no description', async () => {
    mount();

    expect(
      await screen.findByRole('switch', { name: 'settings.sinkCheckedItems.label' })
    ).toBeVisible();
    expect(screen.queryByText('settings.sinkCheckedItems.description')).toBeNull();
  });

  it('makes the colour-blind palette a plain switch with its description', async () => {
    mount();

    const toggle = await screen.findByRole('switch', { name: 'settings.colorBlind.label' });
    expect(toggle.parentElement).toHaveTextContent('settings.colorBlind.description');
  });
});

describe('the colour-blind palette', () => {
  it('persists its toggle', async () => {
    mount();

    const toggle = await screen.findByRole('switch', { name: 'settings.colorBlind.label' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);

    await waitFor(() => expect(storedPrefs()?.colorBlind).toBe(true));
    // The switch reflects the stored blob through a live query, so it settles a tick after the
    // write rather than with it.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('turns back off without disturbing the theme choice', async () => {
    mount();

    const toggle = await screen.findByRole('switch', { name: 'settings.colorBlind.label' });
    await userEvent.click(toggle);
    await waitFor(() => expect(storedPrefs()?.colorBlind).toBe(true));

    await userEvent.click(toggle);

    await waitFor(() => expect(storedPrefs()?.colorBlind).toBe(false));
    // Theme is a separate store, which is the point of making the palette a modifier: toggling
    // it must never write a theme, and must never take one away either.
    expect(storedPrefs()).not.toHaveProperty('theme');
  });
});
