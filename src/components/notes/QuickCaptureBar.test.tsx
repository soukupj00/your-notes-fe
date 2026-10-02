import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { FLOATING_BOTTOM_BAR } from './floatingBottomBar.ts';
import { EMPTY_CHECKLIST_BODY } from './noteDrafts.ts';
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

afterEach(() => {
  localStorage.clear();
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

  it('expands into every way to start a note', async () => {
    await openDial();

    for (const key of ['text', 'checklist', 'audio', 'drawing', 'picture', 'camera']) {
      expect(await screen.findByRole('button', { name: `notes.capture.${key}` })).toBeVisible();
    }
  });

  it.each([
    ['text', { id: null }],
    ['checklist', { id: null, initialBody: EMPTY_CHECKLIST_BODY }],
    ['audio', { id: null, capture: 'audio' }],
    ['drawing', { id: null, capture: 'drawing' }],
  ])('opens the editor in the %s state', async (key, expected) => {
    const onStart = await openDial();

    await userEvent.click(await screen.findByRole('button', { name: `notes.capture.${key}` }));

    expect(onStart).toHaveBeenCalledWith(expected);
  });

  it.each([
    ['picture', 'image/*', null],
    ['camera', 'image/*', 'environment'],
  ])(
    '%s opens the picker inside the tap and starts with the chosen files',
    async (key, accept, capture) => {
      // The tap's user activation is the only thing that can open a picker, and
      // it does not survive the route change to the editor - so the files, not
      // the intent, are what travel.
      const onStart = await openDial();
      const input = screen.getByTestId('start-picker') as HTMLInputElement;
      const click = vi.spyOn(input, 'click');

      await userEvent.click(await screen.findByRole('button', { name: `notes.capture.${key}` }));

      expect(click).toHaveBeenCalledTimes(1);
      expect(input.accept).toBe(accept);
      expect(input.getAttribute('capture')).toBe(capture);
      expect(onStart).not.toHaveBeenCalled();

      const file = new File(['x'], 'a.png', { type: 'image/png' });
      await userEvent.upload(input, file);

      expect(onStart).toHaveBeenCalledWith({ id: null, files: [file] });
    }
  );

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

      // The `＋` and a view's action pill share one constant; asserting it is applied is what
      // stops the two drifting to different heights.
      for (const token of FLOATING_BOTTOM_BAR.split(' ')) {
        expect(strip()).toHaveClass(token);
      }
    });

    it('unrolls from the ＋ upward, keeping the first start nearest the thumb', async () => {
      await openDial();
      const list = (await screen.findByRole('button', { name: 'notes.capture.text' })).closest(
        'ul'
      );

      // Bottom-to-top on screen, but `flex-col-reverse` keeps the DOM in the user's order, which is
      // what tab and screen readers follow.
      expect(list).toHaveClass('flex-col-reverse');
      expect(Array.from(list?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual([
        'notes.capture.text',
        'notes.capture.checklist',
        'notes.capture.audio',
        'notes.capture.drawing',
        'notes.capture.picture',
        'notes.capture.camera',
      ]);
    });

    it('defaults to the right thumb', () => {
      render(<QuickCaptureBar onStart={vi.fn()} />, { wrapper });

      expect(strip()).toHaveClass('justify-end');
    });

    it('mirrors the whole dial, not just the button, for a left-handed layout', async () => {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({ version: 1, noteButtonAlignment: 'left' })
      );
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
