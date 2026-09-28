import { noteTagId } from '@/contract/index.ts';
import type { Attachment, Note, NoteState, NoteTag, Tag } from '@/models.ts';
import type { AttachmentChanges, LocalStore, NoteFeedScope, Snapshot } from '../LocalStore.ts';
import {
  owed,
  type Stored,
  type StoredAttachment,
  strip,
  stripAttachment,
  tombstone,
} from '../syncRows.ts';
import { db as defaultDb, type NotesDB } from './db.ts';
import { migrateLegacyPreferences } from './legacyPreferences.ts';
import { live } from './live.ts';
import { createDexieSync } from './sync.ts';

/**
 * The default Local Store: IndexedDB through Dexie (ADR 0001, ADR 0020).
 *
 * `db` is a parameter only so the contract test can spin up a throwaway
 * database per test; the app passes nothing and gets the singleton.
 */
export function createDexieLocalStore(db: NotesDB = defaultDb): LocalStore {
  // One-shot legacy split (src/data/dexie/legacyPreferences.ts); `meta` waits on
  // it so a Tour sweep on startup cannot read `tourProps` before it has landed.
  // Non-poisoning: a failed migration must not permanently block every later
  // `meta` call - the legacy row is left in place and the migration is retried
  // on the next app start.
  const ready = migrateLegacyPreferences(db).catch((error) =>
    console.error('Legacy preferences migration failed', error)
  );

  const stripAll = <T extends object>(rows: Stored<T>[]): T[] => rows.map(strip);
  const stripOne = <T extends object>(row: Stored<T> | undefined): T | undefined =>
    row && strip(row);
  const plain = (rows: StoredAttachment[]) => rows.map(stripAttachment);
  const plainOne = (row: StoredAttachment | undefined) => row && stripAttachment(row);

  /** Inside a transaction over `notes`: the Note owes its Attachment metadata. No-op if it is gone. */
  const noteOwed = (noteId: string) => db.notes.update(noteId, { dirty: 1 });

  /** Inside a transaction over `notes` and `tombstones`: the Note written owed, keeping its stored Revision. */
  async function writeNote(note: Note) {
    const [stored, gone] = await Promise.all([db.notes.get(note.id), db.tombstones.get(note.id)]);
    await db.notes.put(owed(note, stored?.rev ?? gone?.rev));
    if (gone) await db.tombstones.delete(note.id);
  }

  async function writeTag(tag: Tag) {
    const [stored, gone] = await Promise.all([db.tags.get(tag.id), db.tombstones.get(tag.id)]);
    await db.tags.put(owed(tag, stored?.rev ?? gone?.rev));
    if (gone) await db.tombstones.delete(tag.id);
  }

  /** A new link is owed and takes back a Tombstone for the same pair, with its Revision. */
  async function addLinks(links: NoteTag[]) {
    const ids = links.map((l) => noteTagId(l.noteId, l.tagId));
    const gone = await db.tombstones.bulkGet(ids);
    await db.noteTags.bulkPut(links.map((l, i) => owed(l, gone[i]?.rev)));
    await db.tombstones.bulkDelete(ids);
  }

  /** The feed's read, shared by `feed()` so the join lives in one place. */
  async function readFeed(scope: NoteFeedScope): Promise<Note[]> {
    let candidates = stripAll(await db.notes.where('state').equals(scope.state).toArray());
    if (scope.tagId) {
      const links = await db.noteTags.where('tagId').equals(scope.tagId).toArray();
      const inTag = new Set(links.map((l) => l.noteId));
      candidates = candidates.filter((n) => inTag.has(n.id));
    }
    // Both tables are read whole on purpose: on the active feed the candidates
    // are most of the library, so per-note index seeks would cost more than one
    // sequential read of a two-column join table.
    const [allTags, links] = await Promise.all([db.tags.toArray(), db.noteTags.toArray()]);
    const tagById = new Map(stripAll(allTags).map((t) => [t.id, t]));
    const tagsByNote = new Map<string, Tag[]>();
    for (const l of links) {
      const t = tagById.get(l.tagId);
      if (!t) continue;
      const list = tagsByNote.get(l.noteId);
      if (list) list.push(t);
      else tagsByNote.set(l.noteId, [t]);
    }
    return candidates.map((n) => ({ ...n, tags: tagsByNote.get(n.id) ?? [] }));
  }

  async function tagsForNote(noteId: string): Promise<Tag[]> {
    const links = await db.noteTags.where('noteId').equals(noteId).toArray();
    if (links.length === 0) return [];
    const rows = await db.tags.bulkGet(links.map((l) => l.tagId));
    return rows.filter((t): t is Stored<Tag> => Boolean(t)).map(strip);
  }

  return {
    notes: {
      get: async (id) => stripOne(await db.notes.get(id)),
      list: async () => stripAll(await db.notes.toArray()),
      listByState: async (state: NoteState) =>
        stripAll(await db.notes.where('state').equals(state).toArray()),
      // `trashedAt` is indexed, so this is a range scan; it runs on every app start.
      listTrashedBefore: async (cutoff) =>
        stripAll(await db.notes.where('trashedAt').below(cutoff).toArray()),
      feed: (scope) => live(() => readFeed(scope)),
      add: (note) =>
        db.transaction('rw', db.notes, db.tombstones, async () => {
          await db.notes.add(owed(note, undefined));
          await db.tombstones.delete(note.id);
        }),
      put: (note) => db.transaction('rw', db.notes, db.tombstones, () => writeNote(note)),
      update: (id, change) =>
        db.transaction('rw', db.notes, async () => {
          const stored = await db.notes.get(id);
          if (!stored) return null;
          const before = strip(stored);
          const after = { ...before, ...change(before) };
          await db.notes.put(owed(after, stored.rev));
          return { before, after };
        }),
      purge: (id) =>
        db.transaction('rw', [db.notes, db.noteTags, db.attachments, db.tombstones], async () => {
          const stored = await db.notes.get(id);
          const removedTags = stripAll(await db.noteTags.where('noteId').equals(id).toArray());
          const removedAttachments = plain(
            await db.attachments.where('noteId').equals(id).toArray()
          );
          await db.notes.delete(id);
          await db.noteTags.where('noteId').equals(id).delete();
          await db.attachments.where('noteId').equals(id).delete();
          // One Tombstone: the server removes the Note's links with it.
          if (stored?.rev !== undefined) await db.tombstones.put(tombstone(id, 'note', stored.rev));
          return { removedTags, removedAttachments };
        }),
      restore: (note, removed = {}) =>
        db.transaction('rw', [db.notes, db.noteTags, db.attachments, db.tombstones], async () => {
          await writeNote(note);
          if (removed.removedTags?.length) await addLinks(removed.removedTags);
          if (removed.removedAttachments?.length)
            await db.attachments.bulkPut(removed.removedAttachments);
        }),
    },

    tags: {
      get: async (id) => stripOne(await db.tags.get(id)),
      watch: (id) => live(async () => stripOne(await db.tags.get(id))),
      list: async () => stripAll(await db.tags.toArray()),
      all: () => live(async () => stripAll(await db.tags.toArray())),
      // Through the `name` index rather than a scan: this runs per keystroke-driven create.
      findByName: async (name) =>
        stripOne(await db.tags.where('name').equalsIgnoreCase(name.trim()).first()),
      add: (tag) =>
        db.transaction('rw', db.tags, db.tombstones, async () => {
          await db.tags.add(owed(tag, undefined));
          await db.tombstones.delete(tag.id);
        }),
      put: (tag) => db.transaction('rw', db.tags, db.tombstones, () => writeTag(tag)),
      delete: (id) =>
        db.transaction('rw', db.tags, db.noteTags, db.tombstones, async () => {
          const stored = await db.tags.get(id);
          await db.tags.delete(id);
          await db.noteTags.where('tagId').equals(id).delete();
          // One Tombstone: the server removes the Tag's links with it.
          if (stored?.rev !== undefined) await db.tombstones.put(tombstone(id, 'tag', stored.rev));
        }),
      merge: (sourceId, targetId) => {
        // Merging a tag into itself is a no-op, not a self-delete: without this
        // guard the deletes below would remove the tag and every link to it.
        if (sourceId === targetId) return Promise.resolve();
        return db.transaction('rw', db.tags, db.noteTags, db.tombstones, async () => {
          const target = await db.tags.get(targetId);
          if (!target) throw new Error(`Cannot merge into unknown tag ${targetId}`);
          const source = await db.tags.get(sourceId);
          const sourceLinks = await db.noteTags.where('tagId').equals(sourceId).toArray();
          const targetLinks = await db.noteTags.where('tagId').equals(targetId).toArray();
          const alreadyLinked = new Set(targetLinks.map((l) => l.noteId));
          const now = new Date().toISOString();
          await addLinks(
            sourceLinks
              .filter((l) => !alreadyLinked.has(l.noteId))
              .map((l) => ({
                noteId: l.noteId,
                tagId: targetId,
                createdAt: l.createdAt,
                updatedAt: now,
              }))
          );
          await db.noteTags.where('tagId').equals(sourceId).delete();
          await db.tags.delete(sourceId);
          if (source?.rev !== undefined) {
            await db.tombstones.put(tombstone(sourceId, 'tag', source.rev));
          }
        });
      },
      forNote: (noteId) => live(() => tagsForNote(noteId)),
      link: (link: NoteTag) =>
        db.transaction('rw', db.noteTags, db.tombstones, async () => {
          const exists = await db.noteTags.get([link.noteId, link.tagId]);
          if (!exists) await addLinks([link]);
        }),
      unlink: (noteId, tagId) =>
        db.transaction('rw', db.noteTags, db.tombstones, async () => {
          const stored = await db.noteTags.get([noteId, tagId]);
          if (!stored) return;
          await db.noteTags.delete([noteId, tagId]);
          if (stored.rev !== undefined) {
            await db.tombstones.put(tombstone(noteTagId(noteId, tagId), 'noteTag', stored.rev));
          }
        }),
      listLinks: async () => stripAll(await db.noteTags.toArray()),
    },

    attachments: {
      get: async (id) => plainOne(await db.attachments.get(id)),
      watch: (id) => live(async () => plainOne(await db.attachments.get(id))),
      list: async () => plain(await db.attachments.toArray()),
      forNote: (noteId) =>
        live(async () => plain(await db.attachments.where('noteId').equals(noteId).toArray())),
      forNotes: (noteIds) =>
        live(async () =>
          noteIds.length === 0
            ? ([] as Attachment[])
            : plain(
                await db.attachments
                  .where('noteId')
                  .anyOf([...noteIds])
                  .toArray()
              )
        ),
      add: (attachment) =>
        db.transaction('rw', db.attachments, db.notes, async () => {
          await db.attachments.add(attachment);
          await noteOwed(attachment.noteId);
        }),
      update: (id, changes: AttachmentChanges) =>
        db.transaction('rw', db.attachments, db.notes, async () => {
          const row = await db.attachments.get(id);
          if (!row) return;
          await db.attachments.update(id, changes);
          await noteOwed(row.noteId);
        }),
      delete: (id) =>
        db.transaction('rw', db.attachments, db.notes, async () => {
          const row = await db.attachments.get(id);
          if (!row) return;
          await db.attachments.delete(id);
          await noteOwed(row.noteId);
        }),
      sweepNote: (noteId, keep) =>
        db.transaction('rw', db.attachments, db.notes, async () => {
          const kept = new Set(keep);
          const rows = await db.attachments.where('noteId').equals(noteId).toArray();
          const orphans = rows.filter((r) => !kept.has(r.id));
          await db.attachments.bulkDelete(orphans.map((r) => r.id));
          if (orphans.length) await noteOwed(noteId);
          return orphans.length;
        }),
      sweepAll: (referencedBy) =>
        db.transaction('rw', db.notes, db.attachments, async () => {
          const [notes, all] = await Promise.all([db.notes.toArray(), db.attachments.toArray()]);
          const referenced = new Map(notes.map((n) => [n.id, new Set(referencedBy(n))]));
          // No entry at all means the owner is gone - an orphan for the same reason.
          const orphans = all.filter((row) => !referenced.get(row.noteId)?.has(row.id));
          await db.attachments.bulkDelete(orphans.map((r) => r.id));
          const owners = new Set(orphans.map((r) => r.noteId).filter((id) => referenced.has(id)));
          await Promise.all([...owners].map(noteOwed));
          return orphans.length;
        }),
    },

    // The Dexie table is still called `settings` (no schema bump, ADR 0020);
    // `meta` is what it holds now that Preferences live in localStorage.
    meta: {
      get: async <T>(key: string) => {
        await ready;
        return (await db.settings.get(key))?.value as T | undefined;
      },
      set: async (key, value) => {
        await ready;
        await db.settings.put({ key, value });
      },
      delete: async (key) => {
        await ready;
        await db.settings.delete(key);
      },
    },

    exportAll: () =>
      db.transaction('r', db.notes, db.tags, db.noteTags, db.attachments, async () => {
        const [notes, tags, noteTags, attachments] = await Promise.all([
          db.notes.toArray(),
          db.tags.toArray(),
          db.noteTags.toArray(),
          db.attachments.toArray(),
        ]);
        return {
          notes: stripAll(notes),
          tags: stripAll(tags),
          noteTags: stripAll(noteTags),
          attachments: plain(attachments),
        } satisfies Snapshot;
      }),
    replaceAll: (snapshot) =>
      db.transaction(
        'rw',
        [db.notes, db.tags, db.noteTags, db.attachments, db.tombstones],
        async () => {
          const [notes, tags, links] = await Promise.all([
            db.notes.toArray(),
            db.tags.toArray(),
            db.noteTags.toArray(),
          ]);
          const noteRev = new Map(notes.map((n) => [n.id, n.rev]));
          const tagRev = new Map(tags.map((t) => [t.id, t.rev]));
          const linkRev = new Map(links.map((l) => [noteTagId(l.noteId, l.tagId), l.rev]));
          await Promise.all([
            db.notes.clear(),
            db.tags.clear(),
            db.noteTags.clear(),
            db.attachments.clear(),
            db.tombstones.clear(),
          ]);
          await db.notes.bulkPut(snapshot.notes.map((n) => owed(n, noteRev.get(n.id))));
          await db.tags.bulkPut(snapshot.tags.map((t) => owed(t, tagRev.get(t.id))));
          await db.noteTags.bulkPut(
            snapshot.noteTags.map((l) => owed(l, linkRev.get(noteTagId(l.noteId, l.tagId))))
          );
          await db.attachments.bulkPut(snapshot.attachments);
        }
      ),
    sync: createDexieSync(db),

    clear: () =>
      db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((table) => table.clear()));
      }),
  };
}
