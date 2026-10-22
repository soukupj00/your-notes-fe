import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newNote } from '@/lib/rows.ts';
import { clearStore, renderWithStore as render, testStore } from '@/test/store.tsx';
import { NoteCard } from './NoteCard.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-GB' } }),
}));

vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => false,
}));

const toastMock = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const trashedAt = '2026-10-01T00:00:00.000Z';

async function renderTrashed() {
  const note = newNote({ header: 'Binned', body: '<p>hello</p>', state: 'trashed', trashedAt });
  await testStore.notes.add(note);
  const onSelect = vi.fn();
  render(<NoteCard note={note} onSelect={onSelect} />);
  return { note, onSelect };
}

async function undoLastToast() {
  const opts = toastMock.mock.lastCall?.[1] as { action: { onClick: () => unknown } };
  await opts.action.onClick();
}

const stored = (id: string) => testStore.notes.get(id);

afterEach(async () => {
  toastMock.mockReset();
  await clearStore();
});

describe('NoteCard in the trash', () => {
  it('rails restore, archive and delete forever, in that order, and nothing else', async () => {
    await renderTrashed();

    const rail = document.querySelector('[data-slot="note-card-actions"]') as HTMLElement;
    const names = [...rail.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['notes.restore', 'notes.archive', 'notes.deleteForever']);
    for (const name of ['notes.moveToTrash', 'notes.color', 'notes.pin']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  // Restore and archive clear trashedAt alike, and each undo puts the Note back as it was.
  it.each([
    ['notes.restore', 'active', 'notes.restored'],
    ['notes.archive', 'archived', 'notes.archived'],
  ] as const)(
    '%s moves it to %s with an undo, without opening it',
    async (button, state, toast) => {
      const { note, onSelect } = await renderTrashed();

      await userEvent.click(screen.getByRole('button', { name: button }));

      await waitFor(async () => expect((await stored(note.id))?.state).toBe(state));
      expect((await stored(note.id))?.trashedAt).toBeUndefined();
      expect(toastMock).toHaveBeenCalledWith(toast, expect.anything());
      expect(onSelect).not.toHaveBeenCalled();

      await undoLastToast();
      await waitFor(async () =>
        expect(await stored(note.id)).toMatchObject({ state: 'trashed', trashedAt })
      );
    }
  );

  it('deletes forever only once confirmed, with no undo and without opening the note', async () => {
    const { note, onSelect } = await renderTrashed();

    await userEvent.click(screen.getByRole('button', { name: 'notes.deleteForever' }));
    expect(await stored(note.id)).toBeDefined();
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmDeleteForever.confirm' })
    );

    await waitFor(async () => expect(await stored(note.id)).toBeUndefined());
    expect(toastMock).toHaveBeenCalledWith('notes.deletedForever');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the note when delete forever is cancelled, without opening it', async () => {
    const { note, onSelect } = await renderTrashed();

    await userEvent.click(screen.getByRole('button', { name: 'notes.deleteForever' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmDeleteForever.cancel' })
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'notes.deleteForever' })).toHaveFocus();
    expect(await stored(note.id)).toEqual(note);
    expect(toastMock).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
