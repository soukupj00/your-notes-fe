import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { clearNotesDb } from '@/test/db.ts';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';
import { EMPTY_CHECKLIST_BODY } from './noteDrafts.ts';

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The note bar's controls pair a scale with a material change; the hook behind
// that reads the preferences context, which this suite renders without.
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

// The real Editor is a heavy TipTap/ProseMirror component that is unreliable
// to drive in jsdom; swap it for a plain textarea that forwards onUpdate.
vi.mock('@/components/editor/editor.tsx', () => ({
  Editor: ({
    content,
    onUpdate,
    getNoteId,
  }: {
    content?: string;
    editable?: boolean;
    onUpdate?: (html: string) => void;
    getNoteId?: () => Promise<string>;
  }) => (
    <>
      {/* Controlled (not defaultValue): the real Editor's content is driven by
          the parent's `body` state, and a plain uncontrolled defaultValue would
          desync from React's change tracking once that state updates the DOM
          out from under it (e.g. the async note-load after mount), causing
          later onChange events to silently stop firing. */}
      <textarea
        data-testid="editor"
        value={content ?? ''}
        onChange={(e) => onUpdate?.(e.target.value)}
      />
      {/* Lets a test drive the real Editor's `getNoteId` path (image insert
          persists a draft on demand) without a full ProseMirror instance. */}
      <button type="button" data-testid="ensure-note" onClick={() => void getNoteId?.()}>
        ensure
      </button>
    </>
  ),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'Original header',
    description: '',
    body: 'Original body',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const headerInput = () => screen.getByLabelText('notes.titlePlaceholder');
const editorTextarea = () => screen.getByTestId('editor') as HTMLTextAreaElement;
const closeButton = () => screen.getByRole('button', { name: 'Close' });
// By slot, not by role: an open Radix popover is also a `dialog`.
const dialogSurface = () =>
  document.querySelector('[data-slot="dialog-content"]') as HTMLElement | null;

afterEach(clearNotesDb);

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

  it('seeds a new checklist draft with an empty task list and persists it once edited', async () => {
    render(<NoteEditorDialog noteId={null} initialBody={EMPTY_CHECKLIST_BODY} onClose={vi.fn()} />);

    expect(editorTextarea()).toHaveValue(EMPTY_CHECKLIST_BODY);

    await userEvent.type(editorTextarea(), 'Buy milk');

    await waitFor(async () => expect(await db.notes.count()).toBe(1), { timeout: 2000 });
    const [saved] = await db.notes.toArray();
    expect(saved.body).toContain('Buy milk');
    expect(saved.body).toContain('data-type="taskList"');
  });

  it('surfaces a "saved" status after an edit autosaves', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'Hello');

    expect(
      await screen.findByText('notes.saveStatus.saved', undefined, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  it('stops writing once an edit settles (no autosave re-render loop)', async () => {
    const addSpy = vi.spyOn(db.notes, 'add');
    const putSpy = vi.spyOn(db.notes, 'put');
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'Hi');
    await waitFor(async () => expect(await db.notes.count()).toBe(1), { timeout: 2000 });

    const writesAtSettle = addSpy.mock.calls.length + putSpy.mock.calls.length;
    // Wait well past the debounce with no further edits. A loop (unstable save
    // deps + status re-renders) would keep writing every ~600ms.
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(addSpy.mock.calls.length + putSpy.mock.calls.length).toBe(writesAtSettle);

    addSpy.mockRestore();
    putSpy.mockRestore();
  });

  it('keeps an image-only note (no text) instead of discarding it on close', async () => {
    const user = userEvent.setup();
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    // An image-only body: no header, no text, just an attachment node.
    fireEvent.change(editorTextarea(), {
      target: { value: '<img data-attachment-id="x1">' },
    });

    // Close the dialog (flushes the final save + runs the empty-note check).
    await user.click(closeButton());

    await waitFor(async () => {
      const notes = await db.notes.toArray();
      expect(notes).toHaveLength(1); // kept, not discarded
      expect(notes[0].body).toContain('data-attachment-id="x1"');
    });
  });

  it('keeps an audio-only note (no text) instead of discarding it on close', async () => {
    const user = userEvent.setup();
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    // An audio-only body: no header, no text, just an attachment node.
    fireEvent.change(editorTextarea(), {
      target: { value: '<audio data-attachment-id="au1"></audio>' },
    });

    // Close the dialog (flushes the final save + runs the empty-note check).
    await user.click(closeButton());

    await waitFor(async () => {
      const notes = await db.notes.toArray();
      expect(notes).toHaveLength(1); // kept, not discarded
      expect(notes[0].body).toContain('data-attachment-id="au1"');
    });
  });

  it('does not create two notes when an attach and a save race on a new draft', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    // Type into the draft (marks dirty, non-empty body).
    fireEvent.change(editorTextarea(), { target: { value: '<p>hello</p>' } });

    // Race two "create the draft" paths in the SAME synchronous tick, before
    // either createNote resolves: (1) an image insert -> ensureNoteId, and
    // (2) closing the dialog -> enqueueSave/persist. Both do a sync
    // `idRef.current == null` check; back-to-back fireEvent.click (no awaits
    // between them) guarantees both read null before either sets it. Without
    // serialization through the save chain this creates two Note rows.
    fireEvent.click(screen.getByTestId('ensure-note'));
    fireEvent.click(closeButton());

    // After both paths settle there must be exactly one Note (no silent
    // duplicate / permanent orphan).
    await waitFor(async () => expect(await db.notes.count()).toBe(1));
    // And it must be a stable count, not still resolving toward 2.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await db.notes.count()).toBe(1);
  });

  it('still discards a truly empty draft on close', async () => {
    const user = userEvent.setup();
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);
    fireEvent.change(editorTextarea(), { target: { value: '' } });
    await user.click(closeButton());
    await waitFor(async () => expect(await db.notes.count()).toBe(0));
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

  it('labels an unsaved draft, persisting it through the same ensureNoteId queue', async () => {
    const now = new Date().toISOString();
    await db.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });

    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'tags.add' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Work' }));

    // The draft became a real note, and the label landed on that same note.
    await waitFor(async () => expect(await db.noteTags.count()).toBe(1));
    const link = (await db.noteTags.toArray())[0];
    expect(await db.notes.get(link.noteId)).toBeDefined();
  });

  // ---- Note bar (colour / pin) ---------------------------------------------
  // The editor bar carries only the moves that apply to a note with no card
  // yet: colour, labels and pin. Archive and trash live on the card's foot
  // rail, which is visible at rest on every input type.

  it('colours an unsaved draft through the same ensureNoteId queue', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.blue' }));

    await waitFor(async () => expect(await db.notes.count()).toBe(1));
    const [saved] = await db.notes.toArray();
    expect(saved.color).toBe('blue');
  });

  it('writes a colour change to an existing note and tints the dialog with it', async () => {
    const note = makeNote({ color: 'green' });
    await db.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    // The dialog is the note's own card held open, so it carries the identity.
    await waitFor(() => expect(dialogSurface()).toHaveAttribute('data-note-color', 'green'));

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.red' }));

    await waitFor(async () => expect((await db.notes.get(note.id))?.color).toBe('red'));
    // The tint is the picker's feedback, so it must move with the choice.
    expect(dialogSurface()).toHaveAttribute('data-note-color', 'red');
  });

  it('pins and unpins an existing note from the bar', async () => {
    const note = makeNote();
    await db.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    const pin = screen.getByRole('button', { name: 'notes.pin' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(pin);

    await waitFor(async () => expect((await db.notes.get(note.id))?.pinnedAt).toBeDefined());
    const unpin = await screen.findByRole('button', { name: 'notes.unpin' });
    expect(unpin).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(unpin);
    await waitFor(async () => expect((await db.notes.get(note.id))?.pinnedAt).toBeUndefined());
  });

  it('pins an unsaved draft through the same ensureNoteId queue', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.pin' }));

    await waitFor(async () => expect(await db.notes.count()).toBe(1));
    const [saved] = await db.notes.toArray();
    expect(saved.pinnedAt).toBeDefined();
  });

  it('offers no pin for an archived note, since pinning is meaningless there', async () => {
    const note = makeNote({ state: 'archived' });
    await db.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByDisplayValue(note.header as string);

    expect(screen.queryByRole('button', { name: 'notes.pin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.unpin' })).not.toBeInTheDocument();
    // Colour and labels are authoring moves and stay available.
    expect(screen.getByRole('button', { name: 'notes.color' })).toBeInTheDocument();
  });
});

// On a phone the dialog is a full-screen sheet, so it carries its own app bar
// rather than the vendored close X in the far corner.
describe('the mobile app bar', () => {
  it('closes the note from the back arrow', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const onClose = vi.fn();

    render(<NoteEditorDialog noteId={note.id} onClose={onClose} />);
    await screen.findByDisplayValue(note.header as string);

    await userEvent.click(screen.getByRole('button', { name: 'nav.back' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  // The arrow is the sheet's first focusable child, so Radix would hand it the
  // opening focus: you would open a note with the caret on "leave".
  it('leaves the opening focus in the note, not on the way out', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    const title = await screen.findByLabelText('notes.titlePlaceholder');
    await waitFor(() => expect(title).toHaveFocus());
  });

  // A checklist draft focuses its own body instead, and the redirect above must
  // not race that back up to the title.
  it('leaves a checklist draft focused in its body', async () => {
    render(<NoteEditorDialog noteId={null} initialBody={EMPTY_CHECKLIST_BODY} onClose={vi.fn()} />);

    const title = await screen.findByLabelText('notes.titlePlaceholder');
    await waitFor(() => expect(title).not.toHaveFocus());
  });
});
