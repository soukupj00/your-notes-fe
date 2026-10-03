import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { AppearanceSection } from './AppearanceSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider storageKey="appearance-section-test">
    <PreferencesProvider>{children}</PreferencesProvider>
  </ThemeProvider>
);

async function storedPrefs() {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) throw new Error('nothing written yet');
  return JSON.parse(raw) as Preferences;
}

afterEach(() => {
  localStorage.clear();
});

describe('AppearanceSection', () => {
  it('carries the theme, density and motion groups and the colour-blind and sinking switches, each in order', async () => {
    render(<AppearanceSection />, { wrapper });

    const groups = await screen.findAllByRole('radiogroup');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'settings.theme.label',
      'settings.density.label',
      'settings.reducedMotion.label',
    ]);
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual([
      'settings.colorBlind.label',
      'settings.sinkCheckedItems.label',
    ]);
  });

  it('writes each setting without disturbing its neighbours', async () => {
    // `setPreference` is a read-modify-write on one shared blob, so a section
    // with five controls is exactly where a lost update would show up first.
    const user = userEvent.setup();
    render(<AppearanceSection />, { wrapper });

    await user.click(await screen.findByRole('radio', { name: 'settings.density.compact' }));
    await user.click(await screen.findByRole('radio', { name: 'settings.reducedMotion.always' }));
    await user.click(await screen.findByRole('switch', { name: 'settings.colorBlind.label' }));

    await waitFor(async () => {
      const prefs = await storedPrefs();
      expect(prefs.density).toBe('compact');
      expect(prefs.reducedMotion).toBe('always');
      expect(prefs.colorBlind).toBe(true);
    });
  });
});
