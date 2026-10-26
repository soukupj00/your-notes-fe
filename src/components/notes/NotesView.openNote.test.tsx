import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { renderRoute } from '@/test/renderRoute.tsx';
import { clearStore, testStore } from '@/test/store.tsx';

// Vitest hoists `vi.mock`, so these cannot come from a shared helper.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  default: {},
}));

// jsdom trusts no event; `hardware-key.test.ts` covers the trust check.
vi.mock('@/lib/hardware-key.ts', async (importOriginal) => {
  const { isHardwareKey } = await importOriginal<typeof import('@/lib/hardware-key.ts')>();
  return { isHardwareKey: (event: KeyboardEvent) => isHardwareKey(event, true) };
});

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

// A stand-in for the editor: the real one is TipTap and this suite is about the
// URL, not the surface. It reports the props that decide what gets edited, and
// offers the two callbacks the URL responds to.
vi.mock('@/components/notes/NoteEditorDialog.tsx', () => ({
  NoteEditorDialog: ({
    noteId,
    isNew,
    intent,
    onClose,
    onNoteMissing,
  }: {
    noteId: string;
    isNew?: boolean;
    intent?: { kind: string };
    onClose: () => void;
    onNoteMissing?: () => void;
  }) => (
    <div
      data-testid="editor"
      data-note-id={noteId}
      data-new={isNew ? 'true' : ''}
      data-intent={intent?.kind ?? ''}
    >
      <button type="button" onClick={onClose}>
        close-editor
      </button>
      <button type="button" onClick={() => onNoteMissing?.()}>
        report-missing
      </button>
    </div>
  ),
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
  // Without ResizeObserver `NoteFeed` renders a plain stack. Needed: the global no-op observer
  // never measures, so masonry cards stay in an invisible `aria-hidden` `li` and cannot be clicked.
  // @ts-expect-error deliberately removing the global for this suite
  globalThis.ResizeObserver = undefined;
});

afterEach(async () => {
  globalThis.ResizeObserver = realResizeObserver;
  localStorage.clear();
  await clearStore();
});

describe('opening a note', () => {
  it('names the note in the URL and leaves exactly one entry to go back through', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
    const router = renderRoute('/');

    const before = router.history.length;
    await userEvent.click(await screen.findByRole('button', { name: /Milk and bread/ }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ note: note.id }));
    expect(router.history.length).toBe(before + 1);
    expect(await editor()).toHaveAttribute('data-note-id', note.id);
  });

  it('opens from the URL alone, so a note can be linked to', async () => {
    const note = makeNote();
    await testStore.notes.add(note);

    renderRoute(`/?note=${note.id}`);

    expect(await editor()).toHaveAttribute('data-note-id', note.id);
  });

  // The camera and the audio autoplay are one-shot gestures, not state. If they
  // rode in the URL, reloading an open note would re-fire them.
  it('does not carry a capture intent into a link', async () => {
    const note = makeNote();
    await testStore.notes.add(note);

    renderRoute(`/?note=${note.id}`);

    expect(await editor()).toHaveAttribute('data-intent', '');
  });

  // A draft's id is minted at open, so the URL never has to be rewritten
  // mid-typing - which would remount the editor, since the id is its React key.
  it('gives a new draft its id up front, before anything is persisted', async () => {
    const router = renderRoute('/');

    // The desktop "Take a note…" bar - the plain-note start.
    await userEvent.click(await screen.findByRole('button', { name: /notes.createPlaceholder/ }));

    const el = await editor();
    const id = el.getAttribute('data-note-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // A Start's Draft, not an existing note: nothing has been written yet.
    expect(el).toHaveAttribute('data-new', 'true');
    expect(router.state.location.search).toMatchObject({ note: id });
    expect((await testStore.notes.list()).length).toBe(0);
  });
});

describe('closing a note', () => {
  // A gesture is spent with its open: Forward onto the same note must not record again, nor
  // show the Start's blank draft over a note saved meanwhile (CONTEXT.md "Intent").
  it('does not replay a Start when the note is reopened by going forward', async () => {
    const router = renderRoute('/');
    await userEvent.click(await screen.findByRole('button', { name: 'notes.capture.audio' }));
    const opened = await editor();
    expect(opened).toHaveAttribute('data-intent', 'record');
    expect(opened).toHaveAttribute('data-new', 'true');
    const id = opened.getAttribute('data-note-id');

    await userEvent.click(screen.getByRole('button', { name: 'close-editor' }));
    await waitFor(noEditor);
    router.history.forward();

    const reopened = await editor();
    expect(reopened).toHaveAttribute('data-intent', '');
    expect(reopened).toHaveAttribute('data-new', '');
    expect(reopened).toHaveAttribute('data-note-id', id);
  });

  it('pops the entry it pushed, leaving no dead stop in history', async () => {
    const note = makeNote();
    await testStore.notes.add(note);
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
    await testStore.notes.add(note);
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
    await testStore.notes.add(note);
    const router = renderRoute(`/?note=${note.id}`);

    await editor();
    await userEvent.type(screen.getAllByRole('searchbox')[0], 'milk');

    await waitFor(() => expect(router.state.location.search).toMatchObject({ q: 'milk' }));
    expect(router.state.location.search).toMatchObject({ note: note.id });
    expect(await editor()).toBeInTheDocument();
  });
});

// Last in the file: the key it presses stays seen for the rest of the session.
describe('the new-note key', () => {
  it('opens a Note on a coarse pointer at the first press, which also arms it', async () => {
    const router = renderRoute('/');
    await screen.findByRole('heading', { level: 1 });

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));

    expect(await editor()).toHaveAttribute('data-new', 'true');
    expect(router.state.location.search).toHaveProperty('note');
  });
});
