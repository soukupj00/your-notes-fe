import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '@/models.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteEditorDialog } from './NoteEditorDialog.tsx';

// Archive, trash and restore from the open Note. What it saves is `NoteEditorDialog.test.tsx`.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

vi.mock('@/components/editor/editor.tsx', () => ({
  Editor: ({ content, onUpdate }: { content?: string; onUpdate?: (html: string) => void }) => (
    <textarea
      data-testid="editor"
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
  await screen.findByDisplayValue(note.header);
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

  it('discards a new, empty draft like a close, with nothing to undo', async () => {
    const onClose = vi.fn();
    render(<NoteEditorDialog noteId={crypto.randomUUID()} isNew onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'notes.moveToTrash' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await testStore.notes.list()).toHaveLength(0);
    expect(toastMock).not.toHaveBeenCalled();
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
