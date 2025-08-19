import Dexie, { type Table } from 'dexie';

export interface Note {
  id?: number;
  text: string;
  media?: Blob[]; // audio/images
  createdAt: Date;
}

export interface Tag {
  id?: number;
  name: string;
}

export interface NoteTag {
  id?: number;
  noteId: number;
  tagId: number;
}

export class AppDB extends Dexie {
  notes!: Table<Note>;
  tags!: Table<Tag>;
  noteTags!: Table<NoteTag>;

  constructor() {
    super('AppDB');
    this.version(1).stores({
      notes: '++id, createdAt',
      tags: '++id, name',
      noteTags: '++id, noteId, tagId',
    });
  }
}

export const db = new AppDB();
