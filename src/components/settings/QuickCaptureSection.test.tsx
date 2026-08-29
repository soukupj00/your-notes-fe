import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import type { QuickCapturePref } from '@/components/notes/quickCaptureLayout.ts';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { QuickCaptureSection } from './QuickCaptureSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${Object.values(opts).join(',')}` : key,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

async function storedPrefs() {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) throw new Error('nothing written yet');
  return JSON.parse(raw) as { quickCapture: QuickCapturePref[]; noteButtonAlignment: string };
}

const switchFor = (key: string) =>
  screen.getByRole('switch', { name: `settings.quickCapture.show:notes.capture.${key}` });

afterEach(() => {
  localStorage.clear();
});

describe('QuickCaptureSection', () => {
  it('lists every start, all on, before anything is customised', async () => {
    render(<QuickCaptureSection />, { wrapper });

    expect(await screen.findAllByRole('switch')).toHaveLength(QUICK_CAPTURE_ACTIONS.length);
    for (const action of QUICK_CAPTURE_ACTIONS) expect(switchFor(action.key)).toBeChecked();
  });

  it('persists a start being switched off', async () => {
    const user = userEvent.setup();
    render(<QuickCaptureSection />, { wrapper });

    await user.click(await screen.findByRole('switch', { name: /notes\.capture\.drawing/ }));

    await waitFor(async () => {
      const { quickCapture } = await storedPrefs();
      expect(quickCapture.find((entry) => entry.id === 'drawing')?.on).toBe(false);
      expect(quickCapture.filter((entry) => entry.on)).toHaveLength(
        QUICK_CAPTURE_ACTIONS.length - 1
      );
    });
  });

  it('refuses to switch off the last start, because the dial is the only way in', async () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        quickCapture: QUICK_CAPTURE_ACTIONS.map((action) => ({
          id: action.key,
          on: action.key === 'text',
        })),
      })
    );
    render(<QuickCaptureSection />, { wrapper });

    await waitFor(() => expect(switchFor('text')).toBeDisabled());
    expect(screen.getByText('settings.quickCapture.lastOne')).toBeInTheDocument();
    // The others are still free to come back on.
    expect(switchFor('audio')).toBeEnabled();
  });

  it('persists which side the note button sits on', async () => {
    const user = userEvent.setup();
    render(<QuickCaptureSection />, { wrapper });

    await user.click(
      await screen.findByRole('radio', { name: 'settings.quickCapture.alignment.left' })
    );

    await waitFor(async () => {
      expect((await storedPrefs()).noteButtonAlignment).toBe('left');
    });
  });
});
