import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DENSITY_OPTIONS,
  NOTE_BUTTON_ALIGNMENT_OPTIONS,
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { PreferenceSegmented, PreferenceSwitch } from './SettingsSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

function stored(): Preferences {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) throw new Error('nothing written yet');
  return JSON.parse(raw) as Preferences;
}

afterEach(() => {
  localStorage.clear();
});

describe('PreferenceSwitch', () => {
  it.each([
    ['colorBlind', 'settings.colorBlind', false],
    ['keepEverything', 'sync.keepEverything', false],
  ] as const)(
    '%s starts at its default, says why, and writes the flip',
    async (pref, keys, initial) => {
      render(<PreferenceSwitch pref={pref} keys={keys} />, { wrapper });
      const control = screen.getByRole('switch', { name: `${keys}.label` });
      expect(control).toHaveAttribute('aria-checked', String(initial));
      expect(screen.getByText(`${keys}.description`)).toBeInTheDocument();

      await userEvent.click(control);

      expect(stored()[pref]).toBe(!initial);
    }
  );
});

describe('PreferenceSwitch without a description', () => {
  it('renders the label alone', () => {
    render(
      <PreferenceSwitch
        pref="sinkCheckedItems"
        keys="settings.sinkCheckedItems"
        describe={false}
      />,
      {
        wrapper,
      }
    );

    expect(screen.getByRole('switch', { name: 'settings.sinkCheckedItems.label' })).toBeVisible();
    expect(screen.queryByText('settings.sinkCheckedItems.description')).toBeNull();
  });
});

describe('PreferenceSegmented', () => {
  it.each([
    [
      'noteButtonAlignment',
      NOTE_BUTTON_ALIGNMENT_OPTIONS,
      'settings.quickCapture.alignment',
      'right',
      'left',
    ],
  ] as const)(
    '%s offers every value, starts at its default and writes a choice',
    async (pref, options, keys, initial, next) => {
      render(<PreferenceSegmented pref={pref} options={options} keys={keys} />, { wrapper });
      const group = screen.getByRole('radiogroup', { name: `${keys}.label` });
      expect(within(group).getAllByRole('radio')).toHaveLength(options.length);
      expect(screen.getByRole('radio', { name: `${keys}.${initial}` })).toBeChecked();
      expect(screen.getByText(`${keys}.description`)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', { name: `${keys}.${next}` }));

      expect(stored()[pref]).toBe(next);
    }
  );

  it('keeps the current value when the active option is pressed again', async () => {
    // Radix clears a single ToggleGroup on a repeat press, and a setting must never be empty.
    render(
      <PreferenceSegmented pref="density" options={DENSITY_OPTIONS} keys="settings.density" />,
      { wrapper }
    );

    await userEvent.click(screen.getByRole('radio', { name: 'settings.density.comfortable' }));

    expect(screen.getByRole('radio', { name: 'settings.density.comfortable' })).toBeChecked();
  });
});
