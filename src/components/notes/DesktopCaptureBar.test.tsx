import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { db } from '@/db/db.ts';
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

afterEach(async () => {
  vi.useRealTimers();
  await db.settings.clear();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

describe('DesktopCaptureBar', () => {
  it('cycles the prompt over time', () => {
    render(<DesktopCaptureBar onStart={vi.fn()} />, { wrapper });
    expect(screen.getByText('notes.placeholders.default')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('notes.placeholders.thought')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('notes.placeholders.todo')).toBeInTheDocument();
  });

  it('pins the prompt to the resting copy under reduced motion', () => {
    motion.reduced = true;
    render(<DesktopCaptureBar onStart={vi.fn()} />, { wrapper });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('notes.placeholders.default')).toBeInTheDocument();
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
});
