import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { db } from '@/db/db.ts';
import { FLOATING_BOTTOM_BAR } from './floatingBottomBar.ts';
import { QuickCaptureBar } from './QuickCaptureBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Motion preference is orthogonal to this interaction suite.
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => true,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

afterEach(async () => {
  await db.settings.clear();
});

async function openDial() {
  const onStart = vi.fn();
  render(<QuickCaptureBar onStart={onStart} />, { wrapper });
  await userEvent.click(screen.getByRole('button', { name: 'notes.capture.open' }));
  return onStart;
}

describe('QuickCaptureBar', () => {
  it('starts collapsed to a single button', () => {
    render(<QuickCaptureBar onStart={vi.fn()} />, { wrapper });

    expect(screen.getByRole('button', { name: 'notes.capture.open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.capture.audio' })).not.toBeInTheDocument();
  });

  it('expands into the five ways to start a note', async () => {
    await openDial();

    for (const key of ['text', 'checklist', 'audio', 'drawing', 'picture']) {
      expect(await screen.findByRole('button', { name: `notes.capture.${key}` })).toBeVisible();
    }
  });

  it.each([
    ['text', { id: null }],
    [
      'checklist',
      {
        id: null,
        initialBody:
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
      },
    ],
    ['audio', { id: null, capture: 'audio' }],
    ['drawing', { id: null, capture: 'drawing' }],
    ['picture', { id: null, capture: 'picture' }],
  ])('opens the editor in the %s state', async (key, expected) => {
    const onStart = await openDial();

    await userEvent.click(await screen.findByRole('button', { name: `notes.capture.${key}` }));

    expect(onStart).toHaveBeenCalledWith(expected);
  });

  it('collapses again once an action is taken', async () => {
    await openDial();

    await userEvent.click(await screen.findByRole('button', { name: 'notes.capture.text' }));

    expect(screen.queryByRole('button', { name: 'notes.capture.audio' })).not.toBeInTheDocument();
  });

  describe('where it sits', () => {
    /** The `＋`'s positioning ancestor - the fixed strip, not the button. */
    const strip = () =>
      screen.getByRole('button', { name: 'notes.capture.open' }).closest('div.fixed');

    it('rides on the shared floating geometry rather than its own', () => {
      render(<QuickCaptureBar onStart={vi.fn()} />, { wrapper });

      // The `＋` and a view's action pill land in the same corner and may never
      // sit at different heights, so both take the offsets from one constant.
      // Asserting the constant is applied is what stops the two drifting.
      for (const token of FLOATING_BOTTOM_BAR.split(' ')) {
        expect(strip()).toHaveClass(token);
      }
    });

    it('defaults to the right thumb', () => {
      render(<QuickCaptureBar onStart={vi.fn()} />, { wrapper });

      expect(strip()).toHaveClass('justify-end');
    });

    it('mirrors the whole dial, not just the button, for a left-handed layout', async () => {
      await db.settings.put({
        key: PREFERENCES_KEY,
        value: { version: 1, noteButtonAlignment: 'left' },
      });
      const onStart = vi.fn();
      render(<QuickCaptureBar onStart={onStart} />, { wrapper });

      await waitFor(() => expect(strip()).toHaveClass('justify-start'));

      // The menu follows the same edge. A FAB that moved while its popover
      // stayed put would put the labels under the wrong thumb.
      await userEvent.click(screen.getByRole('button', { name: 'notes.capture.open' }));
      const list = (await screen.findByRole('button', { name: 'notes.capture.text' })).closest(
        'ul'
      );
      expect(list).toHaveClass('items-start');
    });
  });
});
