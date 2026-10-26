import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { PreferenceSwitch, SegmentedSetting } from './SettingsSection.tsx';

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

describe('SegmentedSetting', () => {
  it('keeps the current value when the active option is pressed again', async () => {
    // Radix clears a single ToggleGroup on a repeat press, and a setting must never be empty.
    const onChange = vi.fn();
    render(
      <SegmentedSetting
        label="Theme"
        value="light"
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

    expect(onChange).not.toHaveBeenCalledWith('');
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
  });
});
