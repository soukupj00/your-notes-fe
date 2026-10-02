import Dexie, { type Table } from 'dexie';
import type { Tombstone } from '@/data/Remote.ts';
import type { Stored, StoredAttachment } from '@/data/syncRows.ts';
import type { Note, NoteTag, Setting, Tag } from '@/models.ts';

export class NotesDB extends Dexie {
  notes!: Table<Stored<Note>, string>;
  attachments!: Table<StoredAttachment, string>;
  tags!: Table<Stored<Tag>, string>;
  noteTags!: Table<Stored<NoteTag>, [string, string]>;
  settings!: Table<Setting, string>;
  tombstones!: Table<Tombstone, string>;

  // The name is a parameter only so migration tests can spin up a throwaway
  // database; the app always uses the default singleton below.
  constructor(name = 'NotesDB') {
    super(name);
    this.version(1).stores({
      notes: 'id, header, createdAt, updatedAt',
      images: 'id, noteId',
      audios: 'id, noteId',
      files: 'id, noteId',
      tags: 'id, name',
      noteTags: '[noteId+tagId], noteId, tagId',
    });
    // v2: one `attachments` table replaces the per-type ones. No data migration: shipped UI
    // never wrote them. Dexie drops a store that the new version declares `null`.
    this.version(2).stores({
      attachments: 'id, noteId, kind',
      images: null,
      audios: null,
      files: null,
    });
    // v3: note lifecycle (ADR 0009). The upgrade is required: `state` is indexed and IndexedDB
    // skips rows where it is `undefined`, so an unstamped note would vanish from the feed.
    this.version(3)
      .stores({
        notes: 'id, header, createdAt, updatedAt, state, pinnedAt, trashedAt',
      })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((note) => {
            note.state ??= 'active';
            delete note.checklist;
          })
      );
    // v4: a key-value `settings` store, the Local Store's `meta`; a new key never costs a bump.
    this.version(4).stores({
      settings: 'key',
    });
    // v5: sync metadata (src/data/CLAUDE.md, "Schema"). `dirty` is `1` or absent so its index
    // holds exactly the owed rows. No upgrade: an absent `rev` means never pushed.
    this.version(5).stores({
      notes: 'id, header, createdAt, updatedAt, state, pinnedAt, trashedAt, dirty',
      tags: 'id, name, dirty',
      noteTags: '[noteId+tagId], noteId, tagId, dirty',
      tombstones: 'id',
    });
  }
}

export const db = new NotesDB();
