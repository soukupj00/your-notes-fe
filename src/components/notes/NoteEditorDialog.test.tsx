import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
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

// Hand-off is the one thing the suite cannot exercise: it reaches for
// `navigator.share` and a download. Its result is what the caller branches on.
const handOff = vi.hoisted(() =>
  vi.fn<(file: File) => Promise<'shared' | 'downloaded' | 'cancelled'>>(async () => 'downloaded')
);
vi.mock('@/lib/hand-off.ts', () => ({ handOff }));

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

afterEach(clearStore);

describe('NoteEditorDialog', () => {
  it('loads an existing note once and ignores later external writes (no live query)', async () => {
    const note = makeNote({ header: 'Stored header', body: 'Stored body' });
    await testStore.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue('Stored header')).toBe(headerInput());
    expect(editorTextarea()).toHaveValue('Stored body');

    // Simulate another tab/sync writing to this same note while the dialog
    // is open. Guardrail 1 is that the dialog loads content once and is
    // never re-fed by a live query - a live query here would reset the
    // input under a typing user's cursor. So this external write must NOT
    // be reflected in the open editor.
    await testStore.notes.update(note.id, () => ({ header: 'Changed elsewhere' }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(headerInput()).toHaveValue('Stored header');
    expect(editorTextarea()).toHaveValue('Stored body');
  });

  it('creates a draft on the first meaningful change, exactly once', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'First draft');

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1), {
      timeout: 2000,
    });
    const notes = await testStore.notes.list();
    expect(notes[0].header).toBe('First draft');
    const persistedId = notes[0].id;

    await userEvent.type(headerInput(), ' continued');

    await waitFor(
      async () => {
        const updated = await testStore.notes.get(persistedId);
        expect(updated?.header).toBe('First draft continued');
      },
      { timeout: 2000 }
    );
    expect((await testStore.notes.list()).length).toBe(1);
  });

  it('creates a draft from a body-only edit (empty header), exactly once', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(editorTextarea(), 'Body only draft');

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1), {
      timeout: 2000,
    });
    const notes = await testStore.notes.list();
    expect(notes[0].header).toBe('');
    expect(notes[0].body).toBe('Body only draft');
  });

  it('discards an empty draft on close', async () => {
    const onClose = vi.fn();
    render(<NoteEditorDialog noteId={null} onClose={onClose} />);

    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await testStore.notes.list()).length).toBe(0);
  });

  it('deletes an existing note that is emptied out before closing', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    const onClose = vi.fn();

    render(<NoteEditorDialog noteId={note.id} onClose={onClose} />);
    await screen.findByDisplayValue(note.header as string);

    await userEvent.clear(headerInput());
    await userEvent.clear(editorTextarea());
    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await testStore.notes.get(note.id)).toBeUndefined();
  });

  it('seeds a new checklist draft with an empty task list and persists it once edited', async () => {
    render(<NoteEditorDialog noteId={null} initialBody={EMPTY_CHECKLIST_BODY} onClose={vi.fn()} />);

    expect(editorTextarea()).toHaveValue(EMPTY_CHECKLIST_BODY);

    await userEvent.type(editorTextarea(), 'Buy milk');

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1), {
      timeout: 2000,
    });
    const [saved] = await testStore.notes.list();
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
    const addSpy = vi.spyOn(testStore.notes, 'add');
    const putSpy = vi.spyOn(testStore.notes, 'put');
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'Hi');
    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1), {
      timeout: 2000,
    });

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
      const notes = await testStore.notes.list();
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
      const notes = await testStore.notes.list();
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
    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    // And it must be a stable count, not still resolving toward 2.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await testStore.notes.list()).length).toBe(1);
  });

  it('still discards a truly empty draft on close', async () => {
    const user = userEvent.setup();
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);
    fireEvent.change(editorTextarea(), { target: { value: '' } });
    await user.click(closeButton());
    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(0));
  });

  it('persists an edit to an existing note on close', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    const onClose = vi.fn();

    render(<NoteEditorDialog noteId={note.id} onClose={onClose} />);
    await screen.findByDisplayValue(note.header as string);

    await userEvent.clear(headerInput());
    await userEvent.type(headerInput(), 'Edited header');
    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await testStore.notes.get(note.id))?.header).toBe('Edited header');
  });

  it('labels an unsaved draft, persisting it through the same ensureNoteId queue', async () => {
    const now = new Date().toISOString();
    await testStore.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });

    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'tags.add' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Work' }));

    // The draft became a real note, and the label landed on that same note.
    await waitFor(async () => expect((await testStore.tags.listLinks()).length).toBe(1));
    const link = (await testStore.tags.listLinks())[0];
    expect(await testStore.notes.get(link.noteId)).toBeDefined();
  });

  // ---- Note bar (colour / pin) ---------------------------------------------
  // The editor bar carries only the moves that apply to a note with no card
  // yet: colour, labels and pin. Archive and trash live on the card's foot
  // rail, which is visible at rest on every input type.

  it('colours an unsaved draft through the same ensureNoteId queue', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.blue' }));

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    const [saved] = await testStore.notes.list();
    expect(saved.color).toBe('blue');
  });

  it('writes a colour change to an existing note and tints the dialog with it', async () => {
    const note = makeNote({ color: 'green' });
    await testStore.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    // The dialog is the note's own card held open, so it carries the identity.
    await waitFor(() => expect(dialogSurface()).toHaveAttribute('data-note-color', 'green'));

    await userEvent.click(screen.getByRole('button', { name: 'notes.color' }));
    await userEvent.click(await screen.findByRole('button', { name: 'colors.red' }));

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.color).toBe('red'));
    // The tint is the picker's feedback, so it must move with the choice.
    expect(dialogSurface()).toHaveAttribute('data-note-color', 'red');
  });

  // Setting a Reminder IS handing off (ADR 0021), so the two outcomes of the
  // hand-off are the two cases worth pinning: the fields exist only afterwards.
  async function setReminderFromBar() {
    await userEvent.click(screen.getByRole('button', { name: 'reminders.button' }));
    fireEvent.change(await screen.findByLabelText('reminders.when'), {
      target: { value: '2030-03-04T09:00' },
    });
    await userEvent.selectOptions(screen.getByLabelText('reminders.repeat'), 'weekly');
    await userEvent.click(screen.getByRole('button', { name: 'reminders.addToCalendar' }));
  }

  it('records a Reminder on a draft once the calendar has been given its file', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await setReminderFromBar();

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    await waitFor(async () => {
      const [saved] = await testStore.notes.list();
      expect(saved.remindAt).toBe('2030-03-04T09:00');
      expect(saved.repeat).toBe('weekly');
    });
    expect(handOff).toHaveBeenCalledTimes(1);
  });

  it('records nothing when the hand-off was dismissed', async () => {
    handOff.mockResolvedValueOnce('cancelled');
    const note = makeNote();
    await testStore.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await waitFor(() => expect(headerInput()).toHaveValue('Original header'));
    await setReminderFromBar();

    await waitFor(() => expect(handOff).toHaveBeenCalled());
    expect((await testStore.notes.get(note.id))?.remindAt).toBeUndefined();
  });

  it('pins and unpins an existing note from the bar', async () => {
    const note = makeNote();
    await testStore.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    const pin = screen.getByRole('button', { name: 'notes.pin' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(pin);

    await waitFor(async () => expect((await testStore.notes.get(note.id))?.pinnedAt).toBeDefined());
    const unpin = await screen.findByRole('button', { name: 'notes.unpin' });
    expect(unpin).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(unpin);
    await waitFor(async () =>
      expect((await testStore.notes.get(note.id))?.pinnedAt).toBeUndefined()
    );
  });

  it('pins an unsaved draft through the same ensureNoteId queue', async () => {
    render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.pin' }));

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    const [saved] = await testStore.notes.list();
    expect(saved.pinnedAt).toBeDefined();
  });

  it('offers no pin for an archived note, since pinning is meaningless there', async () => {
    const note = makeNote({ state: 'archived' });
    await testStore.notes.add(note);

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByDisplayValue(note.header as string);

    expect(screen.queryByRole('button', { name: 'notes.pin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.unpin' })).not.toBeInTheDocument();
    // Colour and labels are authoring moves and stay available.
    expect(screen.getByRole('button', { name: 'notes.color' })).toBeInTheDocument();
  });
});

// The note's id is in the URL from the moment the editor opens (ADR 0014), so
// the dialog has to work with an id that names a note which does not exist yet
// - and tell the caller when one names a note that never will.
describe('the id in the URL', () => {
  it('persists a new draft under the id it was given, not a fresh one', async () => {
    const draftId = crypto.randomUUID();
    render(<NoteEditorDialog noteId={null} draftId={draftId} onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'Shopping');

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1), {
      timeout: 2000,
    });
    const [saved] = await testStore.notes.list();
    // Anything else and the URL would be naming a note that does not exist.
    expect(saved.id).toBe(draftId);
  });

  // Reachable without doing anything strange: closing an empty draft purges it,
  // so the history entry the user just came from names a note that is gone.
  it('reports a note that is not there rather than opening an empty editor', async () => {
    const onNoteMissing = vi.fn();
    render(
      <NoteEditorDialog noteId="not-a-real-note" onClose={vi.fn()} onNoteMissing={onNoteMissing} />
    );

    await waitFor(() => expect(onNoteMissing).toHaveBeenCalled());
    // Nothing was written under the dead id on the way past.
    expect((await testStore.notes.list()).length).toBe(0);
  });

  it('says nothing when the note is there', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    const onNoteMissing = vi.fn();

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} onNoteMissing={onNoteMissing} />);
    await screen.findByDisplayValue(note.header as string);

    expect(onNoteMissing).not.toHaveBeenCalled();
  });
});

// On a phone the dialog is a full-screen sheet, so it carries its own app bar
// rather than the vendored close X in the far corner.
describe('the mobile app bar', () => {
  it('closes the note from the back arrow', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
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

describe('opening focus', () => {
  /** `useFinePointer` reads `matchMedia('(pointer: fine)')`. */
  const setPointer = (fine: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: fine)' ? fine : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('focuses the title of a new note on a Coarse pointer, because the user came to type', async () => {
    setPointer(false);
    render(<NoteEditorDialog noteId={null} draftId={crypto.randomUUID()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(headerInput()).toHaveFocus();
    });
  });

  it('focuses nothing for an existing note on a Coarse pointer, so the keyboard stays down', async () => {
    setPointer(false);
    const note = makeNote({ header: 'Kept', body: '<p>text</p>' });
    await testStore.notes.add(note);
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByDisplayValue('Kept');
    expect(headerInput()).not.toHaveFocus();
  });

  it('still focuses the title of an existing note on a Fine pointer', async () => {
    setPointer(true);
    const note = makeNote({ header: 'Kept', body: '<p>text</p>' });
    await testStore.notes.add(note);
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(headerInput()).toHaveFocus();
    });
  });
});
