import Dexie, { type Table } from 'dexie';
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';

export class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  attachments!: Table<Attachment, string>;
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
    // v2: fold the (never-populated) per-type media tables into one generic
    // `attachments` table with a `kind` discriminator. Dropping a store needs
    // it declared `null` in the new version. No data migration - the images/
    // audios/files stores were never written by shipped UI.
    this.version(2).stores({
      attachments: 'id, noteId, kind',
      images: null,
      audios: null,
      files: null,
    });
  }
}

export const db = new NotesDB();
