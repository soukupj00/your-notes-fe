import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import type { Attachment, Note, NoteTag } from '@/models.ts';

// The functions close over nothing but the stable `db` import, so they are
// memoized with empty deps. Stable identities matter: NoteEditorDialog's
// autosave effect depends (transitively) on these, and unstable references
// would make that effect re-run every render and loop the debounced save.
export function useNoteActions() {
  // CREATE a new note
  const createNote = useCallback(async (data: Partial<Note>) => {
    const id = uuid();
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

  // UPDATE an existing note
  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const note = await db.notes.get(id);
    if (!note) return null;

    const updatedNote = { ...note, ...updates, updatedAt: new Date().toISOString() };
    await db.notes.put(updatedNote);
    return updatedNote;
  }, []);

  // DELETE a note and its relationships. Returns the removed noteTags +
  // attachments so the caller can pass them (with the captured note) to
  // restoreNote for a lossless undo.
  const deleteNote = useCallback(async (id: string) => {
    return db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
      const removedTags = await db.noteTags.where('noteId').equals(id).toArray();
      const removedAttachments = await db.attachments.where('noteId').equals(id).toArray();
      await db.notes.delete(id);
      await db.noteTags.where('noteId').equals(id).delete();
      await db.attachments.where('noteId').equals(id).delete();
      return { removedTags, removedAttachments };
    });
  }, []);

  return { createNote, restoreNote, updateNote, deleteNote };
}
