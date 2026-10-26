import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  PreferencesProvider,
} from '@/context/PreferencesProvider.tsx';
import { DisplaySection, ReduceAnimationsSwitch } from './DisplaySection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

function storedPrefs(): Preferences {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) throw new Error('nothing written yet');
  return JSON.parse(raw) as Preferences;
}

function osReducesMotion(reduces: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(prefers-reduced-motion: reduce)' && reduces,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('DisplaySection', () => {
  it('carries the density tiles, then the motion and colour-blind switches', async () => {
    render(<DisplaySection />, { wrapper });

    expect(await screen.findByRole('radiogroup', { name: 'settings.density.label' })).toBeVisible();
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual([
      'settings.reducedMotion.label',
      'settings.colorBlind.label',
    ]);
    expect(screen.getByText('settings.colorBlind.description')).toBeInTheDocument();
  });

  it('writes the density without disturbing the palette', async () => {
    const user = userEvent.setup();
    render(<DisplaySection />, { wrapper });

    await user.click(await screen.findByRole('radio', { name: 'settings.density.compact' }));
    await user.click(screen.getByRole('switch', { name: 'settings.colorBlind.label' }));

    await waitFor(() => {
      expect(storedPrefs().density).toBe('compact');
      expect(storedPrefs().colorBlind).toBe(true);
    });
  });
});

describe('ReduceAnimationsSwitch', () => {
  it.each([
    ['system', false, false, 'always'],
    ['system', true, true, 'never'],
    ['always', false, true, 'never'],
    ['always', true, true, 'never'],
    ['never', false, false, 'always'],
    ['never', true, false, 'always'],
  ] as const)(
    'stored %s with the OS reducing: %s shows %s and a toggle writes %s',
    async (stored, osReduces, checked, afterToggle) => {
      osReducesMotion(osReduces);
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({ version: 2, reducedMotion: stored })
      );
      render(<ReduceAnimationsSwitch />, { wrapper });

      const control = screen.getByRole('switch', { name: 'settings.reducedMotion.label' });
      expect(control).toHaveAttribute('aria-checked', String(checked));
      expect(screen.getByText('settings.reducedMotion.description')).toBeInTheDocument();

      await userEvent.click(control);

      expect(storedPrefs().reducedMotion).toBe(afterToggle);
    }
  );
});
