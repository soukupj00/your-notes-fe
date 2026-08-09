import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import type { Attachment, Note, NoteTag } from '@/models.ts';

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

// The functions close over nothing but the stable `db` import, so they are
// memoized with empty deps. Stable identities matter: NoteEditorDialog's
// autosave effect depends (transitively) on these, and unstable references
// would make that effect re-run every render and loop the debounced save.
export function useNoteActions() {
  const createNote = useCallback(async (data: Partial<Note>) => {
    // An id may be supplied rather than minted: a note's id goes into the URL
    // the moment its editor opens, before there is anything worth persisting,
    // so the draft has to be able to say which id it will eventually take.
    const id = data.id ?? uuid();
    const now = new Date().toISOString();

    const newNote: Note = {
      id,
      header: data.header ?? '',
      description: data.description ?? '',
      body: data.body ?? '',
      state: data.state ?? 'active',
      pinnedAt: data.pinnedAt,
      color: data.color,
      // Carried through so a note seeded straight into the trash still has the
      // timestamp the purge sweep keys off; without it such a note is immortal.
      trashedAt: data.trashedAt,
      createdAt: now,
      updatedAt: now,
    };

    await db.notes.add(newNote);
    return newNote;
  }, []);

  // RESTORE a previously captured note verbatim (for delete-undo): keeps the
  // original id/timestamps and re-links its noteTags + attachments, so undoing
  // a delete reproduces the exact prior state.
  const restoreNote = useCallback(
    async (
      note: Note,
      removed: { removedTags?: NoteTag[]; removedAttachments?: Attachment[] } = {}
    ) => {
      const { removedTags = [], removedAttachments = [] } = removed;
      await db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
        await db.notes.put(note);
        if (removedTags.length > 0) await db.noteTags.bulkPut(removedTags);
        if (removedAttachments.length > 0) await db.attachments.bulkPut(removedAttachments);
      });
      return note;
    },
    []
  );

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const note = await db.notes.get(id);
    if (!note) return null;

    const updatedNote = { ...note, ...updates, updatedAt: new Date().toISOString() };
    await db.notes.put(updatedNote);
    return updatedNote;
  }, []);

  // PURGE a note and its relationships - the permanent, irreversible removal
  // (CONTEXT.md "Purge"). Returns the removed noteTags + attachments so the
  // caller can pass them (with the captured note) to restoreNote for a lossless
  // undo. Normal user-facing deletion goes through trashNote instead.
  const purgeNote = useCallback(async (id: string) => {
    return db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
      const removedTags = await db.noteTags.where('noteId').equals(id).toArray();
      const removedAttachments = await db.attachments.where('noteId').equals(id).toArray();
      await db.notes.delete(id);
      await db.noteTags.where('noteId').equals(id).delete();
      await db.attachments.where('noteId').equals(id).delete();
      return { removedTags, removedAttachments };
    });
  }, []);

  // ---- Lifecycle (ADR 0009) -------------------------------------------------

  // Every transition below is the same shape: read the note, snapshot the
  // lifecycle fields, write the new ones. Sharing one implementation keeps the
  // "snapshot before write" invariant in a single place - if a transition
  // forgot it, its undo would silently do nothing.
  const transition = useCallback(
    async (
      id: string,
      next: (note: Note) => Partial<LifecycleSnapshot>
    ): Promise<LifecycleSnapshot | null> => {
      return db.transaction('rw', db.notes, async () => {
        const note = await db.notes.get(id);
        if (!note) return null;
        const before = snapshotOf(note);
        await db.notes.put({ ...note, ...next(note), updatedAt: new Date().toISOString() });
        return before;
      });
    },
    []
  );

  /** Undo any lifecycle transition by writing its snapshot back verbatim. */
  const revertLifecycle = useCallback(async (id: string, snapshot: LifecycleSnapshot) => {
    return db.transaction('rw', db.notes, async () => {
      const note = await db.notes.get(id);
      if (!note) return null;
      // Spread rather than merge: `pinnedAt`/`trashedAt` are absent-means-unset,
      // so an undo must be able to clear a field the transition set.
      const reverted: Note = {
        ...note,
        state: snapshot.state,
        pinnedAt: snapshot.pinnedAt,
        trashedAt: snapshot.trashedAt,
        updatedAt: snapshot.updatedAt,
      };
      await db.notes.put(reverted);
      return reverted;
    });
  }, []);

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
      const cutoff = graceCutoff(graceDays);
      // `trashedAt` is indexed, so this is a range scan rather than a full
      // table read - it runs on every app start.
      const expired = await db.notes.where('trashedAt').below(cutoff).toArray();
      const stale = expired.filter((note) => note.state === 'trashed');
      for (const note of stale) await purgeNote(note.id);
      return stale.length;
    },
    [purgeNote]
  );

  /** The manual "Empty trash" action - purges everything currently trashed. */
  const emptyTrash = useCallback(async () => {
    const trashed = await db.notes.where('state').equals('trashed').toArray();
    for (const note of trashed) await purgeNote(note.id);
    return trashed.length;
  }, [purgeNote]);

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
