import { useCallback } from 'react';
import type { PurgedRelations } from '@/data/LocalStore.ts';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { newNote } from '@/lib/rows.ts';
import type { Note } from '@/models.ts';

/** How long a Trashed note is kept before the sweep purges it (ADR 0009). */
export const TRASH_GRACE_DAYS = 30;

/**
 * The lifecycle fields a transition is about to overwrite, for an undo to pass `revertLifecycle`.
 * `updatedAt` is included so an undone transition does not leave the note looking freshly edited.
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

// Memoized on the store alone, which the provider creates once: NoteEditorDialog's autosave
// effect depends on these identities.
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

  // Puts a purged note back verbatim (original id and timestamps, tags and attachments re-linked).
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

  // The irreversible removal (CONTEXT.md "Purge"); returns what it removed so `restoreNote` can
  // undo it. The user-facing delete is `trashNote`.
  const purgeNote = useCallback((id: string) => store.notes.purge(id), [store]);

  // ---- Lifecycle (ADR 0009) -------------------------------------------------

  // One atomic update that snapshots before it writes, shared so no transition skips the snapshot.
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
      // Every field is written, `undefined` included: `pinnedAt` and `trashedAt` mean unset when
      // absent, so an undo must be able to clear a field the transition set.
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
