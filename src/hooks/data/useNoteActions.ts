import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import type { Note, NoteTag } from '@/models.ts';

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
      checklist: data.checklist ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await db.notes.add(newNote);
    return newNote;
  }, []);

  // RESTORE a previously captured note verbatim (for delete-undo). Unlike
  // createNote it keeps the original id/timestamps and re-links its noteTags,
  // so undoing a delete reproduces the exact prior state.
  const restoreNote = useCallback(async (note: Note, noteTags: NoteTag[] = []) => {
    await db.transaction('rw', db.notes, db.noteTags, async () => {
      await db.notes.put(note);
      if (noteTags.length > 0) {
        await db.noteTags.bulkPut(noteTags);
      }
    });
    return note;
  }, []);

  // UPDATE an existing note
  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    const note = await db.notes.get(id);
    if (!note) return null;

    const updatedNote = { ...note, ...updates, updatedAt: new Date().toISOString() };
    await db.notes.put(updatedNote);
    return updatedNote;
  }, []);

  // DELETE a note and its relationships. Returns the removed noteTags so the
  // caller can pass them (with the captured note) to restoreNote for undo.
  const deleteNote = useCallback(async (id: string) => {
    return db.transaction('rw', db.notes, db.noteTags, async () => {
      const removedTags = await db.noteTags.where('noteId').equals(id).toArray();
      await db.notes.delete(id);
      await db.noteTags.where('noteId').equals(id).delete();
      return removedTags;
    });
  }, []);

  return { createNote, restoreNote, updateNote, deleteNote };
}
