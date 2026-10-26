import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import type { QuickCapturePref } from '@/components/notes/quickCaptureLayout.ts';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { setViewport } from '@/test/viewport.ts';
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
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('QuickCaptureSection', () => {
  // The dial's own width, where every start is listed under its own name.
  beforeEach(() => setViewport(390));

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

  it('offers the placement as Left and Right tiles and persists the side', async () => {
    const user = userEvent.setup();
    render(<QuickCaptureSection />, { wrapper });

    const placement = screen.getByRole('radiogroup', { name: 'settings.quickCapture.placement' });
    expect(within(placement).getAllByRole('radio')).toHaveLength(2);
    expect(
      within(placement).getByRole('radio', { name: 'settings.quickCapture.alignment.right' })
    ).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'settings.quickCapture.alignment.left' }));

    await waitFor(async () => {
      expect((await storedPrefs()).noteButtonAlignment).toBe('left');
    });
  });

  it('titles the sortable list Menu items', () => {
    render(<QuickCaptureSection />, { wrapper });

    const list = screen.getByRole('heading', { name: 'settings.quickCapture.menuItems' });
    expect(list.closest('section')?.querySelectorAll('[aria-label^="dnd.handle"]')).toHaveLength(
      QUICK_CAPTURE_ACTIONS.length
    );
  });
});

// The desktop bar offers File in Camera's slot (`resolveDesktopQuickCapture`); the list says so.
describe.each([
  [390, 'camera'],
  [1280, 'file'],
])('at %ipx the Camera slot', (width, shown) => {
  it(`is listed as ${shown}`, async () => {
    setViewport(width);
    render(<QuickCaptureSection />, { wrapper });

    expect(await screen.findByText(`notes.capture.${shown}`)).toBeInTheDocument();
    expect(switchFor(shown)).toBeInTheDocument();
  });
});
