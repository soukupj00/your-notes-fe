import type { Note, NoteAudio, NoteFile, NoteImage, NoteTag, Tag } from '@/models.ts';
import Dexie, { type Table } from 'dexie';

export class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  images!: Table<NoteImage, string>;
  audios!: Table<NoteAudio, string>;
  files!: Table<NoteFile, string>;
  tags!: Table<Tag, string>;
  noteTags!: Table<NoteTag, [string, string]>; // composite key

  constructor() {
    super('NotesDB');
    this.version(1).stores({
      notes: 'id, header, createdAt, updatedAt',
      images: 'id, noteId',
      audios: 'id, noteId',
      files: 'id, noteId',
      tags: 'id, name',
      noteTags: '[noteId+tagId], noteId, tagId',
    });
  }
}

export const db = new NotesDB();
