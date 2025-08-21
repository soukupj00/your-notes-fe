import Dexie, { type Table } from 'dexie';

export interface Note {
  id: string;
  header?: string;
  description?: string;
  checklist?: string[]; // array of strings
  createdAt: number;
  updatedAt: number;
}

export interface Image {
  id: string;
  noteId: string; // foreign key
  url: string; // Blob URL or base64
}

export interface Audio {
  id: string;
  noteId: string;
  url: string;
}

export interface FileAttachment {
  id: string;
  noteId: string;
  name: string;
  url: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface NoteTag {
  noteId: string;
  tagId: string;
}

export class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  images!: Table<Image, string>;
  audios!: Table<Audio, string>;
  files!: Table<FileAttachment, string>;
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
