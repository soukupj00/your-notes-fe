import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { NoteCard } from './NoteCard.tsx';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const toastMock = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

// Radix menus rely on APIs jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'My note',
    description: '',
    body: '<p>hello</p>',
    checklist: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(async () => {
  toastMock.mockReset();
  await db.notes.clear();
  await db.noteTags.clear();
});

describe('NoteCard', () => {
  it('opens the editor for its note when the card is activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    await userEvent.click(screen.getByText('My note'));

    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it('opens the editor when the card itself is keyboard-activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    const card = screen.getByText('My note').closest('[role="button"]') as HTMLElement;
    card.focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it('does not open the editor when the overflow menu is keyboard-activated', async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    // Focus the "⋮" trigger and press Enter: the menu opens, but the card's
    // keydown handler must not also fire onSelect (guards against the portalled
    // synthetic-event bubble reopening the editor - including from Delete).
    screen.getByRole('button', { name: 'notes.menu' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('deletes the note and offers an undo that restores it', async () => {
    const note = makeNote();
    await db.notes.add(note);
    render(<NoteCard note={note} onSelect={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.menu' }));
    await userEvent.click(await screen.findByText('notes.delete'));

    await waitFor(async () => expect(await db.notes.get(note.id)).toBeUndefined());
    expect(toastMock).toHaveBeenCalledWith('notes.deleted', expect.anything());

    // Invoke the toast's undo action and confirm the note comes back verbatim.
    const opts = toastMock.mock.calls[0][1] as { action: { onClick: () => void } };
    await opts.action.onClick();

    await waitFor(async () => expect(await db.notes.get(note.id)).toEqual(note));
  });
});
