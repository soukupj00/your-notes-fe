import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
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
    description: '',
    body: 'Original body',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const headerInput = () => screen.getByLabelText('notes.titlePlaceholder');

afterEach(clearStore);

// The note's id is in the URL from the moment the editor opens (ADR 0014), so
// the dialog has to work with an id that names a note which does not exist yet
// - and tell the caller when one names a note that never will.
describe('the id in the URL', () => {
  it('persists a new draft under the id it was given, not a fresh one', async () => {
    const draftId = crypto.randomUUID();
    render(<NoteEditorDialog noteId={draftId} isNew onClose={vi.fn()} />);

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

  it('hands focus back to what had it when the editor opened', async () => {
    setPointer(true);
    const opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    const { unmount } = render(
      <NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={vi.fn()} />
    );
    await waitFor(() => expect(headerInput()).toHaveFocus());
    unmount();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });
});
