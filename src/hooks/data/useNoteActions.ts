import { useCallback } from 'react';
import type { PurgedRelations } from '@/data/LocalStore.ts';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { newNote } from '@/lib/new-note.ts';
import type { Note } from '@/models.ts';

/** How long a Trashed note is kept before the sweep purges it (ADR 0009). */
export const TRASH_GRACE_DAYS = 30;

/**
 * The lifecycle fields a transition touches, captured *before* it runs. Every
 * lifecycle action returns one, so an undo toast can hand it straight back to
 * `revertLifecycle`. `updatedAt` is part of the snapshot on purpose: a
 * transition bumps it (lifecycle changes are real changes, and M5 sync will
 * need to see them), so an undo has to put the old value back or "undo" would
 * still leave the note looking freshly edited.
 */
export type LifecycleSnapshot = Pick<Note, 'state' | 'pinnedAt' | 'trashedAt' | 'updatedAt'>;

function snapshotOf(note: Note): LifecycleSnapshot {
  return {
    state: note.state,
    pinnedAt: note.pinnedAt,
    trashedAt: note.trashedAt,
    updatedAt: note.updatedAt,
  };
}

function graceCutoff(days = TRASH_GRACE_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// The functions close over the store from context, which the provider creates
// once, so they are memoized on it alone. Stable identities matter:
// NoteEditorDialog's autosave effect depends (transitively) on these.
export function useNoteActions() {
  const store = useLocalStore();

  const createNote = useCallback(
    async (data: Partial<Note>) => {
      const note = newNote(data);
      await store.notes.add(note);
      return note;
    },
    [store]
  );

  // RESTORE a previously captured note verbatim (for delete-undo): keeps the
  // original id/timestamps and re-links its noteTags + attachments, so undoing
  // a delete reproduces the exact prior state.
  const restoreNote = useCallback(
    async (note: Note, removed: Partial<PurgedRelations> = {}) => {
      await store.notes.restore(note, removed);
      return note;
    },
    [store]
  );

  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>) => {
      const result = await store.notes.update(id, () => ({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
      return result?.after ?? null;
    },
    [store]
  );

  // PURGE a note and its relationships - the permanent, irreversible removal
  // (CONTEXT.md "Purge"). Returns the removed noteTags + attachments so the
  // caller can pass them (with the captured note) to restoreNote for a lossless
  // undo. Normal user-facing deletion goes through trashNote instead.
  const purgeNote = useCallback((id: string) => store.notes.purge(id), [store]);

  // ---- Lifecycle (ADR 0009) -------------------------------------------------

  // Every transition is the same shape: snapshot the lifecycle fields, write
  // the new ones, in one atomic update. Sharing one implementation keeps the
  // "snapshot before write" invariant in one place.
  const transition = useCallback(
    async (
      id: string,
      next: (note: Note) => Partial<LifecycleSnapshot>
    ): Promise<LifecycleSnapshot | null> => {
      const result = await store.notes.update(id, (note) => ({
        ...next(note),
        updatedAt: new Date().toISOString(),
      }));
      return result ? snapshotOf(result.before) : null;
    },
    [store]
  );

  /** Undo any lifecycle transition by writing its snapshot back verbatim. */
  const revertLifecycle = useCallback(
    async (id: string, snapshot: LifecycleSnapshot) => {
      // Spread rather than merge: `pinnedAt`/`trashedAt` are absent-means-unset,
      // so an undo must be able to clear a field the transition set.
      const result = await store.notes.update(id, () => ({
        state: snapshot.state,
        pinnedAt: snapshot.pinnedAt,
        trashedAt: snapshot.trashedAt,
        updatedAt: snapshot.updatedAt,
      }));
      return result?.after ?? null;
    },
    [store]
  );

  const pinNote = useCallback(
    (id: string) => transition(id, () => ({ pinnedAt: new Date().toISOString() })),
    [transition]
  );
  const unpinNote = useCallback(
    (id: string) => transition(id, () => ({ pinnedAt: undefined })),
    [transition]
  );

  // Archiving and trashing both clear the pin: pinning only means anything for
  // an Active note (ADR 0009), so leaving a stale pin would resurface the note
  // at the top of the feed the moment it is restored.
  const archiveNote = useCallback(
    (id: string) =>
      transition(id, () => ({ state: 'archived', pinnedAt: undefined, trashedAt: undefined })),
    [transition]
  );
  const trashNote = useCallback(
    (id: string) =>
      transition(id, () => ({
        state: 'trashed',
        trashedAt: new Date().toISOString(),
        pinnedAt: undefined,
      })),
    [transition]
  );
  /** Back to the feed - the "Restore" action for both Archive and Trash. */
  const restoreToActive = useCallback(
    (id: string) => transition(id, () => ({ state: 'active', trashedAt: undefined })),
    [transition]
  );

  /**
   * Purge every Trashed note whose grace period has elapsed, cascading its
   * attachments. Runs at startup, alongside the attachment orphan sweep.
   */
  const purgeExpiredTrash = useCallback(
    async (graceDays = TRASH_GRACE_DAYS) => {
      const expired = await store.notes.listTrashedBefore(graceCutoff(graceDays));
      const stale = expired.filter((note) => note.state === 'trashed');
      for (const note of stale) await purgeNote(note.id);
      return stale.length;
    },
    [store, purgeNote]
  );

  /** The manual "Empty trash" action - purges everything currently trashed. */
  const emptyTrash = useCallback(async () => {
    const trashed = await store.notes.listByState('trashed');
    for (const note of trashed) await purgeNote(note.id);
    return trashed.length;
  }, [store, purgeNote]);

  return {
    createNote,
    restoreNote,
    updateNote,
    purgeNote,
    revertLifecycle,
    pinNote,
    unpinNote,
    archiveNote,
    trashNote,
    restoreToActive,
    purgeExpiredTrash,
    emptyTrash,
  };
}
