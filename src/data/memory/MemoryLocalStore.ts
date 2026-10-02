import { noteTagId, parseNoteTagId } from '@/contract/index.ts';
import type { Note, NoteTag, Tag } from '@/models.ts';
import type { LocalStore, NoteFeedScope, Snapshot } from '../LocalStore.ts';
import type { Live } from '../live.ts';
import type { Tombstone } from '../Remote.ts';
import {
  type AcceptedRow,
  acceptedRows,
  fromServerNote,
  markOnServer,
  owed,
  reconcileAttachments,
  type Stored,
  type StoredAttachment,
  settle,
  strip,
  stripAttachment,
  tombstone,
  transferOf,
  wireNote,
  wireRow,
  withReceived,
} from '../syncRows.ts';

type Table = 'notes' | 'tags' | 'noteTags' | 'attachments' | 'meta';

const linkKey = noteTagId;

/**
 * Persists nothing (src/data/CLAUDE.md): atomic by being single-threaded, live by re-reading after
 * a write to a table a Live reads. Rows come back as copies, but an Attachment's Blobs are the
 * same objects it was given: there is no structured clone here.
 */
export function createMemoryLocalStore(): LocalStore {
  const notes = new Map<string, Stored<Note>>();
  const tags = new Map<string, Stored<Tag>>();
  const noteTags = new Map<string, Stored<NoteTag>>();
  const attachments = new Map<string, StoredAttachment>();
  const tombstones = new Map<string, Tombstone>();
  const meta = new Map<string, unknown>();

  const stripOne = <T extends object>(row: Stored<T> | undefined) => row && strip(row);
  const values = <T extends object>(rows: Map<string, Stored<T>>): T[] =>
    [...rows.values()].map(strip);

  /** The row written owed, keeping the Revision held for it, and taking back its Tombstone. */
  function write<T extends object>(rows: Map<string, Stored<T>>, key: string, row: T) {
    rows.set(key, owed(row, rows.get(key)?.rev ?? tombstones.get(key)?.rev));
    tombstones.delete(key);
  }

  /** The row removed, leaving a Tombstone carrying its Revision. */
  function remove<T extends object>(
    rows: Map<string, Stored<T>>,
    key: string,
    kind: Tombstone['kind']
  ) {
    const stored = rows.get(key);
    if (!stored) return;
    rows.delete(key);
    if (stored.rev !== undefined) tombstones.set(key, tombstone(key, kind, stored.rev));
  }

  function noteOwed(noteId: string) {
    const note = notes.get(noteId);
    if (note) notes.set(noteId, { ...note, dirty: 1 });
  }

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
        return t ? [strip(t)] : [];
      });

  const readFeed = (scope: NoteFeedScope): Note[] =>
    values(notes)
      .filter((n) => n.state === scope.state)
      .filter((n) => !scope.tagId || noteTags.has(linkKey(n.id, scope.tagId)))
      .map((n) => ({ ...n, tags: tagsFor(n.id) }));

  const attachmentsFor = (noteId: string) =>
    [...attachments.values()].filter((a) => a.noteId === noteId);
  const plain = (rows: StoredAttachment[]) => rows.map(stripAttachment);
  const plainOne = (row: StoredAttachment | undefined) => row && stripAttachment(row);

  /** Links the server removes with their Note or Tag, so no Tombstones. */
  function deleteLinksWhere(predicate: (l: NoteTag) => boolean) {
    for (const [key, l] of noteTags) if (predicate(l)) noteTags.delete(key);
  }

  return {
    notes: {
      get: async (id) => stripOne(notes.get(id)),
      list: async () => values(notes),
      listByState: async (state) => values(notes).filter((n) => n.state === state),
      listTrashedBefore: async (cutoff) =>
        values(notes).filter((n) => n.trashedAt !== undefined && n.trashedAt < cutoff),
      feed: (scope) => live(['notes', 'tags', 'noteTags'], () => readFeed(scope)),
      add: async (note) => {
        if (notes.has(note.id)) throw new Error(`Note ${note.id} already exists`);
        write(notes, note.id, note);
        changed('notes');
      },
      put: async (note) => {
        write(notes, note.id, note);
        changed('notes');
      },
      update: async (id, change) => {
        const stored = notes.get(id);
        if (!stored) return null;
        const before = strip(stored);
        const after = { ...before, ...change(before) };
        notes.set(id, owed(after, stored.rev));
        changed('notes');
        return { before, after };
      },
      purge: async (id) => {
        const removedTags = values(noteTags).filter((l) => l.noteId === id);
        const removedAttachments = plain(attachmentsFor(id));
        remove(notes, id, 'note');
        deleteLinksWhere((l) => l.noteId === id);
        for (const a of removedAttachments) attachments.delete(a.id);
        changed('notes', 'noteTags', 'attachments');
        return { removedTags, removedAttachments };
      },
      restore: async (note, removed = {}) => {
        write(notes, note.id, note);
        for (const l of removed.removedTags ?? []) write(noteTags, linkKey(l.noteId, l.tagId), l);
        for (const a of removed.removedAttachments ?? []) attachments.set(a.id, a);
        changed('notes', 'noteTags', 'attachments');
      },
    },

    tags: {
      get: async (id) => stripOne(tags.get(id)),
      watch: (id) => live(['tags'], () => stripOne(tags.get(id))),
      list: async () => values(tags),
      all: () => live(['tags'], () => values(tags)),
      findByName: async (name) => {
        const wanted = name.trim().toLowerCase();
        return values(tags).find((t) => t.name.toLowerCase() === wanted);
      },
      add: async (tag) => {
        if (tags.has(tag.id)) throw new Error(`Tag ${tag.id} already exists`);
        write(tags, tag.id, tag);
        changed('tags');
      },
      put: async (tag) => {
        write(tags, tag.id, tag);
        changed('tags');
      },
      delete: async (id) => {
        remove(tags, id, 'tag');
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
            write(noteTags, key, {
              noteId: l.noteId,
              tagId: targetId,
              createdAt: l.createdAt,
              updatedAt: now,
            });
          }
        }
        deleteLinksWhere((l) => l.tagId === sourceId);
        remove(tags, sourceId, 'tag');
        changed('tags', 'noteTags');
      },
      forNote: (noteId) => live(['tags', 'noteTags'], () => tagsFor(noteId)),
      link: async (link) => {
        const key = linkKey(link.noteId, link.tagId);
        if (noteTags.has(key)) return;
        write(noteTags, key, link);
        changed('noteTags');
      },
      unlink: async (noteId, tagId) => {
        remove(noteTags, linkKey(noteId, tagId), 'noteTag');
        changed('noteTags');
      },
      listLinks: async () => values(noteTags),
    },

    attachments: {
      get: async (id) => plainOne(attachments.get(id)),
      watch: (id) => live(['attachments'], () => plainOne(attachments.get(id))),
      list: async () => plain([...attachments.values()]),
      forNote: (noteId) => live(['attachments'], () => plain(attachmentsFor(noteId))),
      forNotes: (noteIds) => {
        const wanted = new Set(noteIds);
        return live(['attachments'], () =>
          plain([...attachments.values()].filter((a) => wanted.has(a.noteId)))
        );
      },
      add: async (attachment) => {
        if (attachments.has(attachment.id))
          throw new Error(`Attachment ${attachment.id} already exists`);
        attachments.set(attachment.id, attachment);
        noteOwed(attachment.noteId);
        changed('attachments', 'notes');
      },
      update: async (id, changes) => {
        const row = attachments.get(id);
        if (!row) return;
        attachments.set(id, { ...row, ...changes });
        noteOwed(row.noteId);
        changed('attachments', 'notes');
      },
      delete: async (id) => {
        const row = attachments.get(id);
        if (!row) return;
        attachments.delete(id);
        noteOwed(row.noteId);
        changed('attachments', 'notes');
      },
      sweepNote: async (noteId, keep) => {
        const kept = new Set(keep);
        const orphans = attachmentsFor(noteId).filter((a) => !kept.has(a.id));
        for (const a of orphans) attachments.delete(a.id);
        if (orphans.length) {
          noteOwed(noteId);
          changed('attachments', 'notes');
        }
        return orphans.length;
      },
      sweepAll: async (referencedBy) => {
        const referenced = new Map(
          [...notes.values()].map((n) => [n.id, new Set(referencedBy(n))])
        );
        const orphans = [...attachments.values()].filter(
          (a) => !referenced.get(a.noteId)?.has(a.id)
        );
        for (const a of orphans) {
          attachments.delete(a.id);
          noteOwed(a.noteId);
        }
        if (orphans.length) changed('attachments', 'notes');
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

    sync: {
      dirty: async () => ({
        notes: [...notes.values()]
          .filter((n) => n.dirty)
          .map((n) => wireNote(n, attachmentsFor(n.id))),
        tags: [...tags.values()].filter((t) => t.dirty).map(wireRow),
        noteTags: [...noteTags.values()].filter((l) => l.dirty).map(wireRow),
        tombstones: [...tombstones.values()],
      }),
      applied: async (batch, outcomes) => {
        const accepted = acceptedRows(batch, outcomes);
        /** Removed while the push was in flight: its Tombstone must carry the new Revision. */
        const rebase = (key: string, a: AcceptedRow) => {
          const gone = tombstones.get(key);
          if (gone && gone.rev === a.row.rev) tombstones.set(key, { ...gone, rev: a.rev });
        };
        for (const a of accepted) {
          if (a.kind === 'tombstone') {
            tombstones.delete(a.row.id);
          } else if (a.kind === 'note') {
            const stored = notes.get(a.row.id);
            if (!stored) rebase(a.row.id, a);
            else notes.set(a.row.id, settle(stored, wireNote(stored, attachmentsFor(a.row.id)), a));
          } else if (a.kind === 'tag') {
            const stored = tags.get(a.row.id);
            if (!stored) rebase(a.row.id, a);
            else tags.set(a.row.id, settle(stored, wireRow(stored), a));
          } else {
            const key = linkKey(a.row.noteId, a.row.tagId);
            const stored = noteTags.get(key);
            if (!stored) rebase(key, a);
            else noteTags.set(key, settle(stored, wireRow(stored), a));
          }
        }
        changed('notes', 'tags', 'noteTags');
      },
      applyPage: async (changes, mode = 'keep-local') => {
        /** In a pull, a row this Device still owes (or has purged) waits for its push. */
        const keepLocal = (stored: { dirty?: 1 } | undefined, key: string) =>
          mode === 'keep-local' && (stored?.dirty === 1 || tombstones.has(key));
        for (const row of changes.notes) {
          if (keepLocal(notes.get(row.id), row.id)) continue;
          notes.set(row.id, fromServerNote(row));
          tombstones.delete(row.id);
          if (!row.attachments) continue;
          const { put, remove } = reconcileAttachments(row.attachments, attachmentsFor(row.id));
          for (const id of remove) attachments.delete(id);
          for (const a of put) attachments.set(a.id, a);
        }
        for (const row of changes.tags) {
          if (keepLocal(tags.get(row.id), row.id)) continue;
          tags.set(row.id, { ...row });
          tombstones.delete(row.id);
        }
        for (const row of changes.noteTags) {
          const key = linkKey(row.noteId, row.tagId);
          if (keepLocal(noteTags.get(key), key)) continue;
          noteTags.set(key, { ...row });
          tombstones.delete(key);
        }
        for (const gone of changes.tombstones) {
          tombstones.delete(gone.id);
          if (gone.kind === 'note') {
            notes.delete(gone.id);
            deleteLinksWhere((l) => l.noteId === gone.id);
            for (const a of attachmentsFor(gone.id)) attachments.delete(a.id);
          } else if (gone.kind === 'tag') {
            tags.delete(gone.id);
            deleteLinksWhere((l) => l.tagId === gone.id);
          } else if (parseNoteTagId(gone.id)) {
            noteTags.delete(gone.id);
          }
        }
        changed('notes', 'tags', 'noteTags', 'attachments');
      },
      resetClean: async () => {
        for (const rows of [notes, tags, noteTags] as Map<string, { dirty?: 1 }>[]) {
          for (const [key, row] of rows) if (row.dirty !== 1) rows.delete(key);
        }
        changed('notes', 'tags', 'noteTags');
      },
      adoptAll: async () => {
        for (const rows of [notes, tags, noteTags] as Map<string, { rev?: number; dirty?: 1 }>[]) {
          for (const [key, row] of rows) {
            const next = { ...row, dirty: 1 as const };
            delete next.rev;
            rows.set(key, next);
          }
        }
        tombstones.clear();
        changed('notes', 'tags', 'noteTags');
      },
      pending: () =>
        live(['notes', 'tags', 'noteTags'], () => {
          const owedRows = [...notes.values(), ...tags.values(), ...noteTags.values()].filter(
            (row) => row.dirty === 1
          );
          return owedRows.length + tombstones.size;
        }),
      transfers: async () =>
        [...attachments.values()].map((row) =>
          transferOf(row, notes.get(row.noteId)?.rev !== undefined)
        ),
      onServer: async (id, blobId) => {
        const row = attachments.get(id);
        if (row) attachments.set(id, markOnServer(row, blobId));
      },
      tooLarge: async (id) => {
        const row = attachments.get(id);
        if (row) attachments.set(id, { ...row, tooLarge: 1 });
      },
      received: async (id, bytes) => {
        const row = attachments.get(id);
        if (!row) return;
        attachments.set(id, withReceived(row, bytes));
        changed('attachments');
      },
    },

    exportAll: async () =>
      ({
        notes: values(notes),
        tags: values(tags),
        noteTags: values(noteTags),
        attachments: plain([...attachments.values()]),
      }) satisfies Snapshot,
    replaceAll: async (snapshot) => {
      const noteRev = new Map([...notes.values()].map((n) => [n.id, n.rev]));
      const tagRev = new Map([...tags.values()].map((t) => [t.id, t.rev]));
      const linkRev = new Map([...noteTags].map(([key, l]) => [key, l.rev]));
      notes.clear();
      tags.clear();
      noteTags.clear();
      attachments.clear();
      tombstones.clear();
      for (const n of snapshot.notes) notes.set(n.id, owed(n, noteRev.get(n.id)));
      for (const t of snapshot.tags) tags.set(t.id, owed(t, tagRev.get(t.id)));
      for (const l of snapshot.noteTags) {
        const key = linkKey(l.noteId, l.tagId);
        noteTags.set(key, owed(l, linkRev.get(key)));
      }
      for (const a of snapshot.attachments) attachments.set(a.id, a);
      changed('notes', 'tags', 'noteTags', 'attachments');
    },
    clear: async () => {
      notes.clear();
      tags.clear();
      noteTags.clear();
      attachments.clear();
      tombstones.clear();
      meta.clear();
      changed('notes', 'tags', 'noteTags', 'attachments', 'meta');
    },
  };
}
