import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';
import type { LocalStore, NoteFeedScope, Snapshot } from '../LocalStore.ts';
import type { Live } from '../live.ts';

type Table = 'notes' | 'tags' | 'noteTags' | 'attachments' | 'meta';

const linkKey = (noteId: string, tagId: string) => `${noteId} ${tagId}`;

/**
 * A Local Store that persists nothing: plain Maps, atomic by being
 * single-threaded, live by re-reading after every write to a table a Live
 * depends on. It is the "cache only" configuration and what the contract
 * suite proves the interface against; the app's default is Dexie.
 *
 * Rows are handed back as the same objects they were given - there is no
 * structured clone here as there is in IndexedDB - so callers must treat what
 * they read as frozen, which they already do.
 */
export function createMemoryLocalStore(): LocalStore {
  const notes = new Map<string, Note>();
  const tags = new Map<string, Tag>();
  const noteTags = new Map<string, NoteTag>();
  const attachments = new Map<string, Attachment>();
  const meta = new Map<string, unknown>();

  const listeners = new Set<{ tables: readonly Table[]; fire: () => void }>();

  /** Tell every Live that reads one of `tables` to read again. */
  function changed(...tables: Table[]) {
    for (const l of listeners) if (l.tables.some((t) => tables.includes(t))) l.fire();
  }

  /** Coarse per-table invalidation is enough here: nothing is on disk to be slow. */
  function live<T>(tables: readonly Table[], read: () => T): Live<T> {
    return {
      subscribe(next) {
        const listener = { tables, fire: () => next(read()) };
        listeners.add(listener);
        // Asynchronous first delivery, like liveQuery, so subscribers cannot
        // observe a value before `subscribe` has returned.
        queueMicrotask(() => {
          if (listeners.has(listener)) listener.fire();
        });
        return () => listeners.delete(listener);
      },
    };
  }

  const tagsFor = (noteId: string): Tag[] =>
    [...noteTags.values()]
      .filter((l) => l.noteId === noteId)
      .flatMap((l) => {
        const t = tags.get(l.tagId);
        return t ? [t] : [];
      });

  const readFeed = (scope: NoteFeedScope): Note[] =>
    [...notes.values()]
      .filter((n) => n.state === scope.state)
      .filter((n) => !scope.tagId || noteTags.has(linkKey(n.id, scope.tagId)))
      .map((n) => ({ ...n, tags: tagsFor(n.id) }));

  const attachmentsFor = (noteId: string) =>
    [...attachments.values()].filter((a) => a.noteId === noteId);

  function deleteLinksWhere(predicate: (l: NoteTag) => boolean) {
    for (const [key, l] of noteTags) if (predicate(l)) noteTags.delete(key);
  }

  return {
    notes: {
      get: async (id) => notes.get(id),
      list: async () => [...notes.values()],
      listByState: async (state) => [...notes.values()].filter((n) => n.state === state),
      listTrashedBefore: async (cutoff) =>
        [...notes.values()].filter((n) => n.trashedAt !== undefined && n.trashedAt < cutoff),
      feed: (scope) => live(['notes', 'tags', 'noteTags'], () => readFeed(scope)),
      add: async (note) => {
        if (notes.has(note.id)) throw new Error(`Note ${note.id} already exists`);
        notes.set(note.id, note);
        changed('notes');
      },
      put: async (note) => {
        notes.set(note.id, note);
        changed('notes');
      },
      update: async (id, change) => {
        const before = notes.get(id);
        if (!before) return null;
        const after = { ...before, ...change(before) };
        notes.set(id, after);
        changed('notes');
        return { before, after };
      },
      purge: async (id) => {
        const removedTags = [...noteTags.values()].filter((l) => l.noteId === id);
        const removedAttachments = attachmentsFor(id);
        notes.delete(id);
        deleteLinksWhere((l) => l.noteId === id);
        for (const a of removedAttachments) attachments.delete(a.id);
        changed('notes', 'noteTags', 'attachments');
        return { removedTags, removedAttachments };
      },
      restore: async (note, removed = {}) => {
        notes.set(note.id, note);
        for (const l of removed.removedTags ?? []) noteTags.set(linkKey(l.noteId, l.tagId), l);
        for (const a of removed.removedAttachments ?? []) attachments.set(a.id, a);
        changed('notes', 'noteTags', 'attachments');
      },
    },

    tags: {
      get: async (id) => tags.get(id),
      watch: (id) => live(['tags'], () => tags.get(id)),
      list: async () => [...tags.values()],
      all: () => live(['tags'], () => [...tags.values()]),
      findByName: async (name) => {
        const wanted = name.trim().toLowerCase();
        return [...tags.values()].find((t) => t.name.toLowerCase() === wanted);
      },
      add: async (tag) => {
        if (tags.has(tag.id)) throw new Error(`Tag ${tag.id} already exists`);
        tags.set(tag.id, tag);
        changed('tags');
      },
      put: async (tag) => {
        tags.set(tag.id, tag);
        changed('tags');
      },
      delete: async (id) => {
        tags.delete(id);
        deleteLinksWhere((l) => l.tagId === id);
        changed('tags', 'noteTags');
      },
      merge: async (sourceId, targetId) => {
        if (sourceId === targetId) return;
        if (!tags.has(targetId)) throw new Error(`Cannot merge into unknown tag ${targetId}`);
        const now = new Date().toISOString();
        for (const l of [...noteTags.values()].filter((l) => l.tagId === sourceId)) {
          const key = linkKey(l.noteId, targetId);
          if (!noteTags.has(key)) {
            noteTags.set(key, {
              noteId: l.noteId,
              tagId: targetId,
              createdAt: l.createdAt,
              updatedAt: now,
            });
          }
        }
        deleteLinksWhere((l) => l.tagId === sourceId);
        tags.delete(sourceId);
        changed('tags', 'noteTags');
      },
      forNote: (noteId) => live(['tags', 'noteTags'], () => tagsFor(noteId)),
      link: async (link) => {
        const key = linkKey(link.noteId, link.tagId);
        if (noteTags.has(key)) return;
        noteTags.set(key, link);
        changed('noteTags');
      },
      unlink: async (noteId, tagId) => {
        noteTags.delete(linkKey(noteId, tagId));
        changed('noteTags');
      },
      listLinks: async () => [...noteTags.values()],
    },

    attachments: {
      get: async (id) => attachments.get(id),
      watch: (id) => live(['attachments'], () => attachments.get(id)),
      list: async () => [...attachments.values()],
      forNote: (noteId) => live(['attachments'], () => attachmentsFor(noteId)),
      forNotes: (noteIds) => {
        const wanted = new Set(noteIds);
        return live(['attachments'], () =>
          [...attachments.values()].filter((a) => wanted.has(a.noteId))
        );
      },
      add: async (attachment) => {
        if (attachments.has(attachment.id))
          throw new Error(`Attachment ${attachment.id} already exists`);
        attachments.set(attachment.id, attachment);
        changed('attachments');
      },
      update: async (id, changes) => {
        const row = attachments.get(id);
        if (!row) return;
        attachments.set(id, { ...row, ...changes });
        changed('attachments');
      },
      delete: async (id) => {
        attachments.delete(id);
        changed('attachments');
      },
      sweepNote: async (noteId, keep) => {
        const kept = new Set(keep);
        const orphans = attachmentsFor(noteId).filter((a) => !kept.has(a.id));
        for (const a of orphans) attachments.delete(a.id);
        if (orphans.length) changed('attachments');
        return orphans.length;
      },
      sweepAll: async (referencedBy) => {
        const referenced = new Map(
          [...notes.values()].map((n) => [n.id, new Set(referencedBy(n))])
        );
        const orphans = [...attachments.values()].filter(
          (a) => !referenced.get(a.noteId)?.has(a.id)
        );
        for (const a of orphans) attachments.delete(a.id);
        if (orphans.length) changed('attachments');
        return orphans.length;
      },
    },

    meta: {
      get: async <T>(key: string) => meta.get(key) as T | undefined,
      set: async (key, value) => {
        meta.set(key, value);
        changed('meta');
      },
      delete: async (key) => {
        meta.delete(key);
        changed('meta');
      },
    },

    exportAll: async () =>
      ({
        notes: [...notes.values()],
        tags: [...tags.values()],
        noteTags: [...noteTags.values()],
        attachments: [...attachments.values()],
      }) satisfies Snapshot,
    replaceAll: async (snapshot) => {
      notes.clear();
      tags.clear();
      noteTags.clear();
      attachments.clear();
      for (const n of snapshot.notes) notes.set(n.id, n);
      for (const t of snapshot.tags) tags.set(t.id, t);
      for (const l of snapshot.noteTags) noteTags.set(linkKey(l.noteId, l.tagId), l);
      for (const a of snapshot.attachments) attachments.set(a.id, a);
      changed('notes', 'tags', 'noteTags', 'attachments');
    },
    clear: async () => {
      notes.clear();
      tags.clear();
      noteTags.clear();
      attachments.clear();
      meta.clear();
      changed('notes', 'tags', 'noteTags', 'attachments', 'meta');
    },
  };
}
