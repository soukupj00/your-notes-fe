import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The real Editor is a heavy TipTap/ProseMirror component that is unreliable
// to drive in jsdom; swap it for a plain textarea that forwards onUpdate.
vi.mock('@/components/editor/editor.tsx', () => ({
  Editor: ({
    content,
    onUpdate,
  }: {
    content?: string;
    editable?: boolean;
    onUpdate?: (html: string) => void;
  }) => (
    // Controlled (not defaultValue): the real Editor's content is driven by
    // the parent's `body` state, and a plain uncontrolled defaultValue would
    // desync from React's change tracking once that state updates the DOM
    // out from under it (e.g. the async note-load after mount), causing
    // later onChange events to silently stop firing.
    <textarea
      data-testid="editor"
      value={content ?? ''}
      onChange={(e) => onUpdate?.(e.target.value)}
    />
  ),
}));

// Radix Dialog relies on APIs jsdom lacks.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'Original header',
    description: '',
    body: 'Original body',
    checklist: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const headerInput = () => screen.getByLabelText('notes.titlePlaceholder');
const editorTextarea = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const closeButton = () => screen.getByRole('button', { name: 'Close' });

afterEach(async () => {
  await db.notes.clear();
  await db.noteTags.clear();
});

describe('NoteEditorDialog', () => {
  it('loads an existing note once and ignores later external writes (no live query)', async () => {
    const note = makeNote({ header: 'Stored header', body: 'Stored body' });
    await db.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue('Stored header')).toBe(headerInput());
    expect(editorTextarea()).toHaveValue('Stored body');

    // Simulate another tab/sync writing to this same note while the dialog
    // is open. Guardrail 1 is that the dialog loads content once and is
    // never re-fed by a live query - a live query here would reset the
    // input under a typing user's cursor. So this external write must NOT
    // be reflected in the open editor.
    await db.notes.update(note.id, { header: 'Changed elsewhere' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(headerInput()).toHaveValue('Stored header');
    expect(editorTextarea()).toHaveValue('Stored body');
  });

  it('creates a draft on the first meaningful change, exactly once', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'First draft');

    await waitFor(async () => expect(await db.notes.count()).toBe(1), { timeout: 2000 });
    const notes = await db.notes.toArray();
    expect(notes[0].header).toBe('First draft');
    const persistedId = notes[0].id;

    await userEvent.type(headerInput(), ' continued');

    await waitFor(
      async () => {
        const updated = await db.notes.get(persistedId);
        expect(updated?.header).toBe('First draft continued');
      },
      { timeout: 2000 }
    );
    expect(await db.notes.count()).toBe(1);
  });

  it('creates a draft from a body-only edit (empty header), exactly once', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(editorTextarea(), 'Body only draft');

    await waitFor(async () => expect(await db.notes.count()).toBe(1), { timeout: 2000 });
    const notes = await db.notes.toArray();
    expect(notes[0].header).toBe('');
    expect(notes[0].body).toBe('Body only draft');
  });

  it('discards an empty draft on close', async () => {
    const onClose = vi.fn();
    render(<NoteEditorDialog noteId={null} onClose={onClose} />);

    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await db.notes.count()).toBe(0);
  });

  it('deletes an existing note that is emptied out before closing', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const onClose = vi.fn();

    render(<NoteEditorDialog noteId={note.id} onClose={onClose} />);
    await screen.findByDisplayValue(note.header as string);

    await userEvent.clear(headerInput());
    await userEvent.clear(editorTextarea());
    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await db.notes.get(note.id)).toBeUndefined();
  });

  it('persists an edit to an existing note on close', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const onClose = vi.fn();

    render(<NoteEditorDialog noteId={note.id} onClose={onClose} />);
    await screen.findByDisplayValue(note.header as string);

    await userEvent.clear(headerInput());
    await userEvent.type(headerInput(), 'Edited header');
    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await db.notes.get(note.id))?.header).toBe('Edited header');
  });
});
