import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { DesktopCaptureBar } from './DesktopCaptureBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const motion = { reduced: false };
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => motion.reduced,
}));

beforeEach(() => {
  // Only the rotation's interval. The bar now reads the preferences store, and
  // faking the whole clock stalls Dexie's async read so hydration never lands.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  motion.reduced = false;
});

afterEach(() => {
  vi.useRealTimers();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

// The MotionValue writes glyphs outside React on rAF, so a fake clock only ever sees them
// mid-string. `data-prompt` is the rotation's contract; the reveal is Motion's business.
const promptKey = () => screen.getByTestId('capture-prompt').getAttribute('data-prompt');

describe('DesktopCaptureBar', () => {
  it('cycles the prompt over time', () => {
    render(<DesktopCaptureBar onStart={vi.fn()} />, { wrapper });
    expect(promptKey()).toBe('notes.placeholders.default');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(promptKey()).toBe('notes.placeholders.thought');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(promptKey()).toBe('notes.placeholders.todo');
  });

  // Translations arrive over HTTP, so on a cold load the resting copy changes
  // from its raw key to real words before any rotation has fired. That change
  // must not read as the user watching their own label being typed.
  it('presents the resting copy whole, before the first rotation', () => {
    render(<DesktopCaptureBar onStart={vi.fn()} />, { wrapper });
    expect(screen.getByTestId('capture-prompt')).toHaveTextContent('notes.placeholders.default');
  });

  it('pins the prompt to the resting copy under reduced motion', () => {
    motion.reduced = true;
    render(<DesktopCaptureBar onStart={vi.fn()} />, { wrapper });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(promptKey()).toBe('notes.placeholders.default');
  });

  // The visible prompt renames itself; the accessible name must not.
  it('keeps one stable accessible name regardless of the rotation', () => {
    render(<DesktopCaptureBar onStart={vi.fn()} />, { wrapper });
    const trigger = screen.getByRole('button', { name: 'notes.createPlaceholder' });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(trigger).toHaveAccessibleName('notes.createPlaceholder');
  });

  it('opens a blank draft from the bar itself', () => {
    const onStart = vi.fn();
    render(<DesktopCaptureBar onStart={onStart} />, { wrapper });

    screen.getByRole('button', { name: 'notes.createPlaceholder' }).click();
    expect(onStart).toHaveBeenCalledWith({ id: null });
  });

  it.each([
    ['picture', 'image/*', null],
    ['camera', 'image/*', 'environment'],
  ])(
    '%s opens the picker inside the click and starts with the chosen files',
    async (key, accept, capture) => {
      // The same contract as the mobile dial's, through the same hook.
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onStart = vi.fn();
      render(<DesktopCaptureBar onStart={onStart} />, { wrapper });
      const input = screen.getByTestId('start-picker') as HTMLInputElement;
      const click = vi.spyOn(input, 'click');

      await user.click(screen.getByRole('button', { name: `notes.capture.${key}` }));

      expect(click).toHaveBeenCalledTimes(1);
      expect(input.accept).toBe(accept);
      expect(input.getAttribute('capture')).toBe(capture);
      expect(onStart).not.toHaveBeenCalled();

      const file = new File(['x'], 'a.png', { type: 'image/png' });
      await user.upload(input, file);

      expect(onStart).toHaveBeenCalledWith({ id: null, files: [file] });
    }
  );
});
