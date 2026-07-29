import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopCaptureBar } from './DesktopCaptureBar.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The quick-capture list pulls its checklist seed from the editor dialog, which
// drags in TipTap/Excalidraw. This suite does not exercise either.
vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: () => null,
  EMPTY_CHECKLIST_BODY: '',
}));

const motion = { reduced: false };
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => motion.reduced,
}));

beforeEach(() => {
  vi.useFakeTimers();
  motion.reduced = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DesktopCaptureBar', () => {
  it('cycles the prompt over time', () => {
    render(<DesktopCaptureBar onStart={vi.fn()} />);
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
    render(<DesktopCaptureBar onStart={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('notes.placeholders.default')).toBeInTheDocument();
  });

  // The visible prompt renames itself; the accessible name must not.
  it('keeps one stable accessible name regardless of the rotation', () => {
    render(<DesktopCaptureBar onStart={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'notes.createPlaceholder' });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(trigger).toHaveAccessibleName('notes.createPlaceholder');
  });

  it('opens a blank draft from the bar itself', () => {
    const onStart = vi.fn();
    render(<DesktopCaptureBar onStart={onStart} />);

    screen.getByRole('button', { name: 'notes.createPlaceholder' }).click();
    expect(onStart).toHaveBeenCalledWith({ id: null });
  });
});
