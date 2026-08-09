import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Note } from '@/models.ts';
import { clearNotesDb } from '@/test/db.ts';
import { renderRoute } from '@/test/renderRoute.tsx';

// Vitest hoists `vi.mock`, so these cannot come from a shared helper.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

// A stand-in for the editor: the real one is TipTap and this suite is about the
// URL, not the surface. It reports the props that decide what gets edited, and
// offers the two callbacks the URL responds to.
vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: ({
    noteId,
    draftId,
    initialCapture,
    onClose,
    onNoteMissing,
  }: {
    noteId: string | null;
    draftId?: string;
    initialCapture?: string;
    onClose: () => void;
    onNoteMissing?: () => void;
  }) => (
    <div
      data-testid="editor"
      data-note-id={noteId ?? ''}
      data-draft-id={draftId ?? ''}
      data-capture={initialCapture ?? ''}
    >
      <button type="button" onClick={onClose}>
        close-editor
      </button>
      <button type="button" onClick={() => onNoteMissing?.()}>
        report-missing
      </button>
    </div>
  ),
  EMPTY_CHECKLIST_BODY: '<ul data-type="taskList"></ul>',
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'Milk and bread',
    description: '',
    body: 'Body',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const editor = () => screen.findByTestId('editor');
const noEditor = () => expect(screen.queryByTestId('editor')).not.toBeInTheDocument();

const realResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  window.innerWidth = 1024;
  // Take ResizeObserver away, which puts `NoteFeed` on its documented
  // no-measurement path: a plain DOM-ordered stack.
  //
  // This is not a convenience. The global test setup stubs ResizeObserver with
  // a no-op, so `supported` is true but nothing is ever measured - and an
  // unmeasured masonry card renders inside an `aria-hidden`, `invisible` `li`
  // until its placement lands. A card is therefore *unclickable* in jsdom under
  // the default view mode, which is why nothing had covered opening a note from
  // the feed before now.
  // @ts-expect-error deliberately removing the global for this suite
  globalThis.ResizeObserver = undefined;
});

afterEach(async () => {
  globalThis.ResizeObserver = realResizeObserver;
  localStorage.clear();
  await clearNotesDb();
});

describe('opening a note', () => {
  it('names the note in the URL and leaves exactly one entry to go back through', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const router = renderRoute('/');

    const before = router.history.length;
    await userEvent.click(await screen.findByRole('button', { name: /Milk and bread/ }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ note: note.id }));
    expect(router.history.length).toBe(before + 1);
    expect(await editor()).toHaveAttribute('data-note-id', note.id);
  });

  it('opens from the URL alone, so a note can be linked to', async () => {
    const note = makeNote();
    await db.notes.add(note);

    renderRoute(`/?note=${note.id}`);

    expect(await editor()).toHaveAttribute('data-note-id', note.id);
  });

  // The camera and the audio autoplay are one-shot gestures, not state. If they
  // rode in the URL, reloading an open note would re-fire them.
  it('does not carry a capture intent into a link', async () => {
    const note = makeNote();
    await db.notes.add(note);

    renderRoute(`/?note=${note.id}`);

    expect(await editor()).toHaveAttribute('data-capture', '');
  });

  // A draft's id is minted at open, so the URL never has to be rewritten
  // mid-typing - which would remount the editor, since the id is its React key.
  it('gives a new draft its id up front, before anything is persisted', async () => {
    const router = renderRoute('/');

    // The desktop "Take a note…" bar - the plain-note start.
    await userEvent.click(await screen.findByRole('button', { name: /notes.createPlaceholder/ }));

    const el = await editor();
    const id = el.getAttribute('data-draft-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // Not an existing note: nothing has been written yet.
    expect(el).toHaveAttribute('data-note-id', '');
    expect(router.state.location.search).toMatchObject({ note: id });
    expect(await db.notes.count()).toBe(0);
  });
});

describe('closing a note', () => {
  it('pops the entry it pushed, leaving no dead stop in history', async () => {
    const note = makeNote();
    await db.notes.add(note);
    // Two entries deep, so the assertion below can tell a pop from a replace.
    // Arriving from `/` only, both leave you on `/` and look identical.
    const router = renderRoute(['/archive', '/']);

    await userEvent.click(await screen.findByRole('button', { name: /Milk and bread/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ note: note.id }));

    await userEvent.click(screen.getByText('close-editor'));

    await waitFor(() => noEditor());
    expect(router.state.location.search).not.toHaveProperty('note');

    // The editor left no trace: one more back reaches what came before the
    // feed. Closing with a replace instead would stack a second `/` entry, and
    // this press would land on `/` again - a back button that does nothing.
    router.history.back();
    await waitFor(() => expect(router.state.location.pathname).toBe('/archive'));
  });

  // Opened cold there is nothing to pop, and popping anyway would leave the app
  // - which on an installed iOS PWA means relaunching it.
  it('clears the param in place when the note was opened cold', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const router = renderRoute(`/?note=${note.id}`);

    await userEvent.click(await screen.findByText('close-editor'));

    await waitFor(() => noEditor());
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).not.toHaveProperty('note');
  });

  // Reachable in normal use: closing an empty draft purges it, so the entry the
  // user just came from names a note that is no longer there.
  it('drops a note param that points at nothing, without touching history', async () => {
    const router = renderRoute('/?note=does-not-exist');

    const atStart = router.history.length;
    await userEvent.click(await screen.findByText('report-missing'));

    await waitFor(() => noEditor());
    expect(router.state.location.search).not.toHaveProperty('note');
    // Replaced, so back does not walk straight into the dead note again.
    expect(router.history.length).toBe(atStart);
  });
});

describe('the feed behind an open note', () => {
  // On desktop the feed and its search box sit behind the editor. `note` is not
  // feed state, so the search writer has to carry it explicitly or typing a
  // query would close the note.
  it('keeps the note open while the query changes', async () => {
    const note = makeNote();
    await db.notes.add(note);
    const router = renderRoute(`/?note=${note.id}`);

    await editor();
    await userEvent.type(screen.getAllByRole('searchbox')[0], 'milk');

    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'milk' }));
    expect(router.state.location.search).toMatchObject({ note: note.id });
    expect(await editor()).toBeInTheDocument();
  });
});
