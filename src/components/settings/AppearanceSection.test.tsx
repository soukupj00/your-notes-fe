import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PREFERENCES_KEY,
  type Preferences,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { ThemeProvider } from '@/context/themeProvider.tsx';
import { db } from '@/db/db.ts';
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
  const row = await db.settings.get(PREFERENCES_KEY);
  if (!row) throw new Error('nothing written yet');
  return row.value as Preferences;
}

afterEach(async () => {
  localStorage.clear();
  await db.settings.clear();
});

describe('AppearanceSection', () => {
  describe('density', () => {
    it('starts comfortable', async () => {
      render(<AppearanceSection />, { wrapper });

      expect(
        await screen.findByRole('radio', { name: 'settings.density.comfortable' })
      ).toBeChecked();
    });

    it('persists the switch to compact', async () => {
      const user = userEvent.setup();
      render(<AppearanceSection />, { wrapper });

      await user.click(await screen.findByRole('radio', { name: 'settings.density.compact' }));

      await waitFor(async () => expect((await storedPrefs()).density).toBe('compact'));
    });

    it('keeps the current density when the active option is pressed again', async () => {
      // Radix clears a single-select ToggleGroup's value on a repeat press. A
      // setting has no "none" state, so the guard has to hold: pressing
      // Comfortable while comfortable must leave it comfortable, not unset.
      const user = userEvent.setup();
      render(<AppearanceSection />, { wrapper });

      const comfortable = await screen.findByRole('radio', {
        name: 'settings.density.comfortable',
      });
      await user.click(comfortable);

      await waitFor(async () => expect((await storedPrefs()).density).toBe('comfortable'));
      expect(comfortable).toBeChecked();
    });
  });

  describe('reduced motion', () => {
    it('starts on the device setting', async () => {
      render(<AppearanceSection />, { wrapper });

      expect(
        await screen.findByRole('radio', { name: 'settings.reducedMotion.system' })
      ).toBeChecked();
    });

    it.each([
      ['settings.reducedMotion.always', 'always'],
      ['settings.reducedMotion.never', 'never'],
    ] as const)('persists the %s override', async (name, value) => {
      const user = userEvent.setup();
      render(<AppearanceSection />, { wrapper });

      await user.click(await screen.findByRole('radio', { name }));

      await waitFor(async () => expect((await storedPrefs()).reducedMotion).toBe(value));
    });
  });

  describe('colour-blind palette', () => {
    it('persists being switched on', async () => {
      const user = userEvent.setup();
      render(<AppearanceSection />, { wrapper });

      await user.click(await screen.findByRole('switch', { name: 'settings.colorBlind.label' }));

      await waitFor(async () => expect((await storedPrefs()).colorBlind).toBe(true));
    });
  });

  describe('sink checked items', () => {
    // On by default since ADR 0013 made sinking a presentation rule, so the
    // direction a user actually travels here is off - the escape hatch for a
    // list where sequence is the content.
    it('persists being switched off', async () => {
      const user = userEvent.setup();
      render(<AppearanceSection />, { wrapper });

      const toggle = await screen.findByRole('switch', {
        name: 'settings.sinkCheckedItems.label',
      });
      expect(toggle).toBeChecked();

      await user.click(toggle);

      await waitFor(async () => expect((await storedPrefs()).sinkCheckedItems).toBe(false));
    });

    it('persists being switched back on', async () => {
      const user = userEvent.setup();
      render(<AppearanceSection />, { wrapper });

      const toggle = await screen.findByRole('switch', {
        name: 'settings.sinkCheckedItems.label',
      });
      await user.click(toggle);
      await waitFor(async () => expect((await storedPrefs()).sinkCheckedItems).toBe(false));

      await user.click(toggle);

      await waitFor(async () => expect((await storedPrefs()).sinkCheckedItems).toBe(true));
    });
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
