import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';

// Archive, trash and restore from the open Note, and the trash's read-only preview. What it saves
// is `NoteEditorDialog.test.tsx`.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

vi.mock('@/components/editor/editor.tsx', () => ({
  Editor: ({
    content,
    editable,
    onUpdate,
  }: {
    content?: string;
    editable?: boolean;
    onUpdate?: (html: string) => void;
  }) => (
    <textarea
      data-testid="editor"
      readOnly={!editable}
      value={content ?? ''}
      onChange={(e) => onUpdate?.(e.target.value)}
    />
  ),
}));

const toastMock = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    header: 'Kept',
    description: '',
    body: 'Body',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function undoLastToast() {
  const opts = toastMock.mock.lastCall?.[1] as { action: { onClick: () => unknown } };
  await opts.action.onClick();
}

async function openStored(overrides: Partial<Note> = {}) {
  const note = makeNote(overrides);
  await testStore.notes.add(note);
  const onClose = vi.fn();
  render(<NoteEditorDialog noteId={note.id} onClose={onClose} />);
  await screen.findByDisplayValue(note.body as string);
  return { note, onClose };
}

afterEach(async () => {
  toastMock.mockReset();
  await clearStore();
});

describe('NoteEditorDialog lifecycle', () => {
  it('archives the open note, closes, and offers the same undo as the card', async () => {
    const { note, onClose } = await openStored();

    await userEvent.click(screen.getByRole('button', { name: 'notes.archive' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await testStore.notes.get(note.id))?.state).toBe('archived');
    expect(toastMock).toHaveBeenCalledWith('notes.archived', expect.anything());

    await undoLastToast();
    await waitFor(async () => expect((await testStore.notes.get(note.id))?.state).toBe('active'));
  });

  it('saves what was typed before moving the note to trash', async () => {
    const { note, onClose } = await openStored();

    await userEvent.type(screen.getByTestId('editor'), ' more');
    await userEvent.click(screen.getByRole('button', { name: 'notes.moveToTrash' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await testStore.notes.get(note.id)).toMatchObject({
      state: 'trashed',
      body: 'Body more',
    });
    expect(toastMock).toHaveBeenCalledWith('notes.movedToTrash', expect.anything());
  });

  it('moves the note once however fast the button is pressed again', async () => {
    const { onClose } = await openStored();
    const archive = screen.getByRole('button', { name: 'notes.archive' });

    await userEvent.dblClick(archive);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('discards a new, empty draft like a close, with nothing to undo', async () => {
    const onClose = vi.fn();
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.moveToTrash' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await testStore.notes.list()).toHaveLength(0);
    expect(toastMock).not.toHaveBeenCalled();
  });

  // Until the load, `state` is only the default 'active', so a trashed Note would offer the
  // edit bar's moves: Archive would archive it, Move to trash would restart its grace period.
  it('offers no lifecycle move before the note has loaded', async () => {
    const note = makeNote({ state: 'trashed', trashedAt: new Date().toISOString() });
    await testStore.notes.add(note);
    let finishLoad = () => {};
    const get = vi.spyOn(testStore.notes, 'get').mockImplementationOnce(
      (id) =>
        new Promise((resolve) => {
          finishLoad = () => resolve(testStore.notes.get(id));
        })
    );
    render(<NoteEditorDialog noteId={note.id} onClose={vi.fn()} />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    for (const name of ['notes.archive', 'notes.moveToTrash', 'notes.restore']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }

    finishLoad();

    expect(await screen.findByText('notes.trashedPreview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'notes.moveToTrash' })).not.toBeInTheDocument();
    get.mockRestore();
  });

  it('offers restore instead of archive on an archived note', async () => {
    const { note, onClose } = await openStored({ state: 'archived' });

    expect(screen.queryByRole('button', { name: 'notes.archive' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'notes.restore' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await testStore.notes.get(note.id))?.state).toBe('active');
    expect(toastMock).toHaveBeenCalledWith('notes.restored', expect.anything());
  });
});

describe('a trashed note', () => {
  const trashed = { state: 'trashed' as const, trashedAt: new Date().toISOString() };

  it('opens as a read-only preview with only restore, archive and delete forever', async () => {
    await openStored(trashed);

    expect(screen.getByRole('heading', { name: 'Kept' })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'notes.titlePlaceholder' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('editor')).toHaveAttribute('readonly');
    for (const name of [
      'notes.color',
      'reminders.button',
      'notes.pin',
      'tags.add',
      'notes.moveToTrash',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    const bar = document.querySelector('[data-slot="note-editor-bar"]') as HTMLElement;
    expect([...bar.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'notes.restore',
      'notes.archive',
      'notes.deleteForever',
    ]);
  });

  it.each([
    ['notes.restore', 'active', 'notes.restored'],
    ['notes.archive', 'archived', 'notes.archived'],
  ] as const)(
    '%s from the preview moves it to %s with the undo the card has',
    async (button, state, toast) => {
      const { note, onClose } = await openStored(trashed);

      await userEvent.click(screen.getByRole('button', { name: button }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(await testStore.notes.get(note.id)).toMatchObject({ state, trashedAt: undefined });
      expect(toastMock).toHaveBeenCalledWith(toast, expect.anything());

      await undoLastToast();
      await waitFor(async () =>
        expect(await testStore.notes.get(note.id)).toMatchObject({
          state: 'trashed',
          trashedAt: trashed.trashedAt,
        })
      );
    }
  );

  it('keeps the note open and stored when delete forever is cancelled', async () => {
    const { note, onClose } = await openStored(trashed);

    await userEvent.click(screen.getByRole('button', { name: 'notes.deleteForever' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmDeleteForever.cancel' })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'notes.confirmDeleteForever.confirm' })
      ).not.toBeInTheDocument()
    );
    expect(await testStore.notes.get(note.id)).toEqual(note);
    expect(onClose).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('deletes forever only once the user confirms', async () => {
    const { note, onClose } = await openStored(trashed);

    await userEvent.click(screen.getByRole('button', { name: 'notes.deleteForever' }));
    expect(await testStore.notes.get(note.id)).toBeDefined();
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmDeleteForever.confirm' })
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await testStore.notes.get(note.id)).toBeUndefined();
  });

  it('writes nothing on close, so even an empty one survives', async () => {
    const { note, onClose } = await openStored({ ...trashed, header: '', body: '' });
    await screen.findByRole('button', { name: 'notes.deleteForever' });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await testStore.notes.get(note.id)).toEqual(note);
  });
});
