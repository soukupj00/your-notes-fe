import Dexie, { type Table } from 'dexie';
import type { Attachment, Note, NoteTag, Setting, Tag } from '@/models.ts';

export class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  attachments!: Table<Attachment, string>;
  tags!: Table<Tag, string>;
  noteTags!: Table<NoteTag, [string, string]>; // composite key
  settings!: Table<Setting, string>;

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
    // v3: note lifecycle (ADR 0009). Adds the `state` enum plus the orthogonal
    // `pinnedAt`/`color`/`trashedAt`, and retires the never-used `checklist`
    // (the real checklist is a TipTap TaskList inside the Body).
    //
    // This one *does* need an `.upgrade()`, unlike the other optional fields:
    // `state` is indexed, and IndexedDB skips rows whose indexed property is
    // `undefined`. Without stamping existing rows, every pre-v3 note would be
    // invisible to `where('state')` - i.e. would silently vanish from the feed.
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
    // v4: a generic key-value `settings` store. Only the value is versioned
    // (the preferences blob carries its own schema `version`), so adding a
    // preference never costs a Dexie bump - no migration needed here.
    this.version(4).stores({
      settings: 'key',
    });
  }
}

export const db = new NotesDB();
