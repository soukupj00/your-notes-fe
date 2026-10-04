import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';
import { EMPTY_CHECKLIST_BODY } from './noteDrafts.ts';

// What the dialog saves. How it opens (the id, the app bar, focus) is
// `NoteEditorDialog.opening.test.tsx`.

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
      {/* Controlled, not defaultValue: once the async note-load rewrites an uncontrolled
          textarea, later onChange events silently stop firing. */}
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

    // Another tab writes to this note while it is open. The dialog loads once and is never
    // re-fed by a live query, which would reset a typing user's cursor, so this must not show.
    await testStore.notes.update(note.id, () => ({ header: 'Changed elsewhere' }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(headerInput()).toHaveValue('Stored header');
    expect(editorTextarea()).toHaveValue('Stored body');
  });

  it('creates a draft on the first meaningful change, exactly once', async () => {
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

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
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

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
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={onClose} />);

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
    render(
      <NoteEditorDialog
        noteId={crypto.randomUUID()}
        isNew
        intent={{ kind: 'checklist' }}
        onClose={vi.fn()}
      />
    );

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
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'Hello');

    expect(
      await screen.findByText('notes.saveStatus.saved', undefined, { timeout: 2000 })
    ).toBeInTheDocument();
  });

  it('stops writing once an edit settles (no autosave re-render loop)', async () => {
    const addSpy = vi.spyOn(testStore.notes, 'add');
    const putSpy = vi.spyOn(testStore.notes, 'put');
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

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

  it.each([
    ['image', '<img data-attachment-id="x1">'],
    ['audio', '<audio data-attachment-id="au1"></audio>'],
  ])('keeps an %s-only note (no text) instead of discarding it on close', async (_, body) => {
    const user = userEvent.setup();
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    fireEvent.change(editorTextarea(), { target: { value: body } });

    await user.click(closeButton());

    await waitFor(async () => {
      const notes = await testStore.notes.list();
      expect(notes).toHaveLength(1);
      expect(notes[0].body).toBe(body);
    });
  });

  it('does not create two notes when an attach and a save race on a new draft', async () => {
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    fireEvent.change(editorTextarea(), { target: { value: '<p>hello</p>' } });

    // Both create paths (the Editor's getNoteId and close) in one synchronous tick, so both read
    // "no row yet" before either writes one. Without the Draft's one queue this creates two notes.
    fireEvent.click(screen.getByTestId('ensure-note'));
    fireEvent.click(closeButton());

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    // And it must be a stable count, not still resolving toward 2.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await testStore.notes.list()).length).toBe(1);
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

  it('labels a new Draft, which earns its row first', async () => {
    const now = new Date().toISOString();
    await testStore.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });

    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'tags.add' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Work' }));

    await waitFor(async () => expect((await testStore.tags.listLinks()).length).toBe(1));
    const link = (await testStore.tags.listLinks())[0];
    expect(await testStore.notes.get(link.noteId)).toBeDefined();
  });

  // ---- Note bar (colour / pin) ---------------------------------------------

  it.each([
    ['colours', ['notes.color', 'colors.blue'], (saved: Note) => expect(saved.color).toBe('blue')],
    ['pins', ['notes.pin'], (saved: Note) => expect(saved.pinnedAt).toBeDefined()],
  ])('%s a new Draft, which earns its row first', async (_, taps, check) => {
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    for (const name of taps) await userEvent.click(await screen.findByRole('button', { name }));

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    const [saved] = await testStore.notes.list();
    check(saved);
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
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    await setReminderFromBar();

    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));
    await waitFor(async () => {
      const [saved] = await testStore.notes.list();
      expect(saved.remindAt).toBe('2030-03-04T09:00');
      expect(saved.repeat).toBe('weekly');
    });
    expect(handOff).toHaveBeenCalledTimes(1);
  });

  // The Draft and the calendar file both read what is typed through the dialog's `content`, so a
  // Reminder set before the 600 ms autosave has run still carries the header in both.
  it('gives a Reminder set before the autosave the typed header, in the row and in the file', async () => {
    const add = vi.spyOn(testStore.notes, 'add');
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);
    fireEvent.change(headerInput(), { target: { value: 'Dentist' } });

    await setReminderFromBar();

    await waitFor(() => expect(add).toHaveBeenCalled());
    expect(add.mock.calls[0][0].header).toBe('Dentist');
    expect(await handOff.mock.lastCall?.[0].text()).toContain('Dentist');
    add.mockRestore();
  });

  // The calendar already holds an event linking to this note, so purging it would leave that
  // event pointing at nothing.
  it('keeps a draft that was given a Reminder, even with no header or body', async () => {
    const onClose = vi.fn();
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={onClose} />);

    await setReminderFromBar();
    await waitFor(async () => expect((await testStore.notes.list()).length).toBe(1));

    await userEvent.click(closeButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [saved] = await testStore.notes.list();
    expect(saved).toBeDefined();
    expect(saved.remindAt).toBe('2030-03-04T09:00');
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

  it('leaves the bell unlit when the write fails after a successful hand-off', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    const update = vi
      .spyOn(testStore.notes, 'update')
      .mockRejectedValueOnce(new Error('quota exceeded'));

    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await waitFor(() => expect(headerInput()).toHaveValue('Original header'));
    await setReminderFromBar();

    // The calendar was given the file, so the hand-off is not what went wrong -
    // the store is. A lit bell would promise an alarm nothing recorded.
    await waitFor(() => expect(update).toHaveBeenCalled());
    // The popover is modal and stays open on a failure, which puts the trigger
    // behind it; close it to reach the bell the user would be looking at.
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: 'reminders.button' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    update.mockRestore();
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
