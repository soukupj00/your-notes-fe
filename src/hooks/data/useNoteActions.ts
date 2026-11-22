import { useCallback } from 'react';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { newNote, nowIso } from '@/lib/rows.ts';
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

function graceCutoff() {
  return new Date(Date.now() - TRASH_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
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

  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>) => {
      const result = await store.notes.update(id, () => ({
        ...updates,
        updatedAt: nowIso(),
      }));
      return result?.after ?? null;
    },
    [store]
  );

  // A plain read, not a live one: the editor loads a Note once and keeps its own copy.
  const getNote = useCallback((id: string) => store.notes.get(id), [store]);

  // The irreversible removal (CONTEXT.md "Purge"). The user-facing delete is `trashNote`.
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
        updatedAt: nowIso(),
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
    (id: string) => transition(id, () => ({ pinnedAt: nowIso() })),
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
        trashedAt: nowIso(),
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
  const purgeExpiredTrash = useCallback(async () => {
    const expired = await store.notes.listTrashedBefore(graceCutoff());
    const stale = expired.filter((note) => note.state === 'trashed');
    for (const note of stale) await purgeNote(note.id);
    return stale.length;
  }, [store, purgeNote]);

  /** The manual "Empty trash" action - purges everything currently trashed. */
  const emptyTrash = useCallback(async () => {
    const trashed = await store.notes.listByState('trashed');
    for (const note of trashed) await purgeNote(note.id);
    return trashed.length;
  }, [store, purgeNote]);

  return {
    getNote,
    createNote,
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
