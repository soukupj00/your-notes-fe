import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { db } from '@/db/db.ts';
import SettingsPage from './settings.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The page links to /settings/labels; the link target is not what this file is
// about, and rendering it for real would drag in a router.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

afterEach(async () => {
  document.documentElement.classList.remove('cvd');
  await db.settings.clear();
});

const storedPrefs = async () =>
  (await db.settings.get(PREFERENCES_KEY))?.value as Record<string, unknown> | undefined;

function mount() {
  return render(
    <ThemeProvider>
      <PreferencesProvider>
        <SettingsPage />
      </PreferencesProvider>
    </ThemeProvider>
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
