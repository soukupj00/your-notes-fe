import { db } from '@/db/db';
import type { Note } from '@/models';
import { v4 as uuid } from 'uuid';

export function useNoteActions() {
  // CREATE a new note
  const createNote = async (data: Partial<Note>) => {
    const id = uuid();
    const now = new Date().toISOString();

    const newNote: Note = {
      id,
      header: data.header ?? '',
      description: data.description ?? '',
      checklist: data.checklist ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await db.notes.add(newNote);
    return newNote;
  };

  // UPDATE an existing note
  const updateNote = async (id: string, updates: Partial<Note>) => {
    const note = await db.notes.get(id);
    if (!note) return null;

    const updatedNote = { ...note, ...updates, updatedAt: new Date().toISOString() };
    await db.notes.put(updatedNote);
    return updatedNote;
  };

  // DELETE a note and its relationships
  const deleteNote = async (id: string) => {
    await db.transaction('rw', db.notes, db.noteTags, async () => {
      await db.notes.delete(id);
      await db.noteTags.where('noteId').equals(id).delete();
    });
  };

  return { createNote, updateNote, deleteNote };
}
