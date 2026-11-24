import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { allNotes } from '@/test/storeReads.ts';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';

// How the dialog opens and closes: the id it is given, the sheet's app bar and where focus lands.
// What it saves is `NoteEditorDialog.test.tsx`.

// Keys pass through untranslated so assertions are stable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

// The note bar's controls pair a scale with a material change; the hook behind
// that reads the preferences context, which this suite renders without.
vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

// The real Editor is a heavy TipTap/ProseMirror component that is unreliable
// to drive in jsdom; swap it for a plain textarea that forwards onUpdate.
vi.mock('@/components/editor/editor.tsx', () => ({
  Editor: ({ content, onUpdate }: { content?: string; onUpdate?: (html: string) => void }) => (
    <textarea
      data-testid="editor"
      value={content ?? ''}
      onChange={(e) => onUpdate?.(e.target.value)}
    />
  ),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'Original header',
    body: 'Original body',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const headerInput = () => screen.getByLabelText('notes.titlePlaceholder');

/** The heading the dialog is named by. */
const dialogTitle = () => {
  const id = screen.getByRole('dialog').getAttribute('aria-labelledby');
  return document.getElementById(id ?? '');
};

afterEach(clearStore);

// The note's id is in the URL from the moment the editor opens (ADR 0014), so
// the dialog has to work with an id that names a note which does not exist yet
// - and tell the caller when one names a note that never will.
describe('the id in the URL', () => {
  it('persists a new draft under the id it was given, not a fresh one', async () => {
    const draftId = crypto.randomUUID();
    render(<NoteEditorDialog noteId={draftId} isNew onClose={vi.fn()} />);

    await userEvent.type(headerInput(), 'Shopping');

    await waitFor(async () => expect((await allNotes(testStore)).length).toBe(1), {
      timeout: 2000,
    });
    const [saved] = await allNotes(testStore);
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
    expect((await allNotes(testStore)).length).toBe(0);
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
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);

    const title = await screen.findByLabelText('notes.titlePlaceholder');
    await waitFor(() => expect(title).toHaveFocus());
  });

  // A checklist draft focuses its own body instead, and the redirect above must
  // not race that back up to the title.
  it('leaves a checklist draft focused in its body', async () => {
    render(
      <NoteEditorDialog
        noteId={crypto.randomUUID()}
        isNew
        intent={{ kind: 'checklist' }}
        onClose={vi.fn()}
      />
    );

    const title = await screen.findByLabelText('notes.titlePlaceholder');
    await waitFor(() => expect(title).not.toHaveFocus());
  });
});

// A screen reader hears which Note opened, not "Edit note" for every one.
describe("the dialog's name", () => {
  it.each([
    ['its title', 'Groceries', 'notes.editNamedNoteTitle'],
    ['the plain name without one', '  ', 'notes.editNoteTitle'],
  ])('names an existing note by %s', async (_, header, name) => {
    const note = makeNote({ header });
    await testStore.notes.add(note);
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByDisplayValue('Original body');
    expect(screen.getByRole('dialog')).toHaveAccessibleName(name);
  });

  it('names a new note as new', () => {
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('notes.newNoteTitle');
  });
});

describe('opening focus', () => {
  /** Answers the primary and the any-pointer query alike. */
  const setPointer = (fine: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('pointer: fine') ? fine : false,
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
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />);
    await waitFor(() => {
      expect(headerInput()).toHaveFocus();
    });
  });

  // Not the title, so the software keyboard stays down; not nothing, which would leave focus on
  // the Card behind the modal, hidden from a screen reader.
  it("focuses the dialog's heading for an existing note on a Coarse pointer", async () => {
    setPointer(false);
    const note = makeNote({ header: 'Kept', body: '<p>text</p>' });
    await testStore.notes.add(note);
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByDisplayValue('Kept');
    expect(dialogTitle()).toHaveFocus();
  });

  // On a Fine pointer the title takes focus at the open and leaves when the load finds the Note
  // in the trash.
  it.each([
    ['Coarse', false],
    ['Fine', true],
  ])("focuses the dialog's heading for a Trash preview on a %s pointer", async (_, fine) => {
    setPointer(fine);
    const note = makeNote({ state: 'trashed', trashedAt: new Date().toISOString() });
    await testStore.notes.add(note);
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByText('notes.trashedPreview');
    await waitFor(() => expect(dialogTitle()).toHaveFocus());
  });

  // A screen reader reads the heading as focus lands on it; a later change is not announced.
  it.each([
    ['an existing note', 'active' as const, 'notes.editNamedNoteTitle', false],
    ['a Trash preview', 'trashed' as const, 'notes.editNamedNoteTitle', true],
  ])(
    'focuses the heading of %s only once it reads the loaded note',
    async (_, state, name, described) => {
      setPointer(false);
      const note = makeNote({
        state,
        trashedAt: state === 'trashed' ? new Date().toISOString() : undefined,
      });
      await testStore.notes.add(note);
      const heard: { name: string; described: boolean }[] = [];
      const onFocusIn = (event: FocusEvent) => {
        if (event.target !== dialogTitle()) return;
        heard.push({
          name: dialogTitle()?.textContent ?? '',
          described: screen.getByRole('dialog').hasAttribute('aria-describedby'),
        });
      };
      document.addEventListener('focusin', onFocusIn);
      render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

      await waitFor(() => expect(dialogTitle()).toHaveFocus());
      document.removeEventListener('focusin', onFocusIn);
      expect(heard).toEqual([{ name, described }]);
    }
  );

  it('describes a Trash preview by its trash line, read as it opens', async () => {
    const note = makeNote({ state: 'trashed', trashedAt: new Date().toISOString() });
    await testStore.notes.add(note);
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);
    await screen.findByText('notes.trashedPreview');
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('notes.trashedPreview');
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

  it('hands focus back once it has closed', async () => {
    const returnFocus = vi.fn();
    const { unmount } = render(
      <NoteEditorDialog
        noteId={crypto.randomUUID()}
        isNew
        onClose={vi.fn()}
        returnFocus={returnFocus}
      />
    );
    await waitFor(() => expect(headerInput()).toHaveFocus());
    unmount();
    await waitFor(() => expect(returnFocus).toHaveBeenCalledOnce());
  });
});
