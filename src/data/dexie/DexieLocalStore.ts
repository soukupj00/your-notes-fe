import { liveQuery } from 'dexie';
import type { Attachment, Note, NoteState, NoteTag, Tag } from '@/models.ts';
import type { AttachmentChanges, LocalStore, NoteFeedScope, Snapshot } from '../LocalStore.ts';
import type { Live } from '../live.ts';
import { db as defaultDb, type NotesDB } from './db.ts';
import { migrateLegacyPreferences } from './legacyPreferences.ts';

/** Dexie's `liveQuery` already is the contract; this only narrows its Observable to `Live<T>`. */
function live<T>(querier: () => T | Promise<T>): Live<T> {
  return {
    subscribe(next) {
      const subscription = liveQuery(querier).subscribe(next);
      return () => subscription.unsubscribe();
    },
  };
}

/**
 * The default Local Store: IndexedDB through Dexie (ADR 0001, ADR 0020).
 *
 * `db` is a parameter only so the contract test can spin up a throwaway
 * database per test; the app passes nothing and gets the singleton.
 */
export function createDexieLocalStore(db: NotesDB = defaultDb): LocalStore {
  // One-shot legacy split (src/data/dexie/legacyPreferences.ts); `meta` waits on
  // it so a Tour sweep on startup cannot read `tourProps` before it has landed.
  const ready = migrateLegacyPreferences(db);

  /** The feed's read, shared by `feed()` so the join lives in one place. */
  async function readFeed(scope: NoteFeedScope): Promise<Note[]> {
    let candidates = await db.notes.where('state').equals(scope.state).toArray();
    if (scope.tagId) {
      const links = await db.noteTags.where('tagId').equals(scope.tagId).toArray();
      const inTag = new Set(links.map((l) => l.noteId));
      candidates = candidates.filter((n) => inTag.has(n.id));
    }
    // Both tables are read whole on purpose: on the active feed the candidates
    // are most of the library, so per-note index seeks would cost more than one
    // sequential read of a two-column join table.
    const [allTags, links] = await Promise.all([db.tags.toArray(), db.noteTags.toArray()]);
    const tagById = new Map(allTags.map((t) => [t.id, t]));
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
    return rows.filter((t): t is Tag => Boolean(t));
  }

  return {
    notes: {
      get: (id) => db.notes.get(id),
      list: () => db.notes.toArray(),
      listByState: (state: NoteState) => db.notes.where('state').equals(state).toArray(),
      // `trashedAt` is indexed, so this is a range scan; it runs on every app start.
      listTrashedBefore: (cutoff) => db.notes.where('trashedAt').below(cutoff).toArray(),
      feed: (scope) => live(() => readFeed(scope)),
      add: async (note) => {
        await db.notes.add(note);
      },
      put: async (note) => {
        await db.notes.put(note);
      },
      update: (id, change) =>
        db.transaction('rw', db.notes, async () => {
          const before = await db.notes.get(id);
          if (!before) return null;
          const after = { ...before, ...change(before) };
          await db.notes.put(after);
          return { before, after };
        }),
      purge: (id) =>
        db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
          const removedTags = await db.noteTags.where('noteId').equals(id).toArray();
          const removedAttachments = await db.attachments.where('noteId').equals(id).toArray();
          await db.notes.delete(id);
          await db.noteTags.where('noteId').equals(id).delete();
          await db.attachments.where('noteId').equals(id).delete();
          return { removedTags, removedAttachments };
        }),
      restore: (note, removed = {}) =>
        db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
          await db.notes.put(note);
          if (removed.removedTags?.length) await db.noteTags.bulkPut(removed.removedTags);
          if (removed.removedAttachments?.length)
            await db.attachments.bulkPut(removed.removedAttachments);
        }),
    },

    tags: {
      get: (id) => db.tags.get(id),
      watch: (id) => live(() => db.tags.get(id)),
      list: () => db.tags.toArray(),
      all: () => live(() => db.tags.toArray()),
      // Through the `name` index rather than a scan: this runs per keystroke-driven create.
      findByName: (name) => db.tags.where('name').equalsIgnoreCase(name.trim()).first(),
      add: async (tag) => {
        await db.tags.add(tag);
      },
      put: async (tag) => {
        await db.tags.put(tag);
      },
      delete: (id) =>
        db.transaction('rw', db.tags, db.noteTags, async () => {
          await db.tags.delete(id);
          await db.noteTags.where('tagId').equals(id).delete();
        }),
      merge: (sourceId, targetId) => {
        // Merging a tag into itself is a no-op, not a self-delete: without this
        // guard the deletes below would remove the tag and every link to it.
        if (sourceId === targetId) return Promise.resolve();
        return db.transaction('rw', db.tags, db.noteTags, async () => {
          const target = await db.tags.get(targetId);
          if (!target) throw new Error(`Cannot merge into unknown tag ${targetId}`);
          const sourceLinks = await db.noteTags.where('tagId').equals(sourceId).toArray();
          const targetLinks = await db.noteTags.where('tagId').equals(targetId).toArray();
          const alreadyLinked = new Set(targetLinks.map((l) => l.noteId));
          const now = new Date().toISOString();
          await db.noteTags.bulkAdd(
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
        });
      },
      forNote: (noteId) => live(() => tagsForNote(noteId)),
      link: (link: NoteTag) =>
        db.transaction('rw', db.noteTags, async () => {
          const exists = await db.noteTags.get([link.noteId, link.tagId]);
          if (!exists) await db.noteTags.add(link);
        }),
      unlink: async (noteId, tagId) => {
        await db.noteTags.delete([noteId, tagId]);
      },
      listLinks: () => db.noteTags.toArray(),
    },

    attachments: {
      get: (id) => db.attachments.get(id),
      watch: (id) => live(() => db.attachments.get(id)),
      list: () => db.attachments.toArray(),
      forNote: (noteId) => live(() => db.attachments.where('noteId').equals(noteId).toArray()),
      forNotes: (noteIds) =>
        live(() =>
          noteIds.length === 0
            ? Promise.resolve([] as Attachment[])
            : db.attachments
                .where('noteId')
                .anyOf([...noteIds])
                .toArray()
        ),
      add: async (attachment) => {
        await db.attachments.add(attachment);
      },
      update: async (id, changes: AttachmentChanges) => {
        await db.attachments.update(id, changes);
      },
      delete: async (id) => {
        await db.attachments.delete(id);
      },
      sweepNote: (noteId, keep) =>
        db.transaction('rw', db.attachments, async () => {
          const kept = new Set(keep);
          const rows = await db.attachments.where('noteId').equals(noteId).toArray();
          const orphans = rows.filter((r) => !kept.has(r.id));
          await db.attachments.bulkDelete(orphans.map((r) => r.id));
          return orphans.length;
        }),
      sweepAll: (referencedBy) =>
        db.transaction('rw', db.notes, db.attachments, async () => {
          const [notes, all] = await Promise.all([db.notes.toArray(), db.attachments.toArray()]);
          const referenced = new Map(notes.map((n) => [n.id, new Set(referencedBy(n))]));
          // No entry at all means the owner is gone - an orphan for the same reason.
          const orphans = all.filter((row) => !referenced.get(row.noteId)?.has(row.id));
          await db.attachments.bulkDelete(orphans.map((r) => r.id));
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
        return { notes, tags, noteTags, attachments } satisfies Snapshot;
      }),
    replaceAll: (snapshot) =>
      db.transaction('rw', db.notes, db.tags, db.noteTags, db.attachments, async () => {
        await Promise.all([
          db.notes.clear(),
          db.tags.clear(),
          db.noteTags.clear(),
          db.attachments.clear(),
        ]);
        await db.notes.bulkPut(snapshot.notes);
        await db.tags.bulkPut(snapshot.tags);
        await db.noteTags.bulkPut(snapshot.noteTags);
        await db.attachments.bulkPut(snapshot.attachments);
      }),
    clear: () =>
      db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((table) => table.clear()));
      }),
  };
}
