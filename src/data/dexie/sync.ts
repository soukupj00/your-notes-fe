import { noteTagId, parseNoteTagId } from '@/contract/index.ts';
import type { LocalStore } from '../LocalStore.ts';
import {
  type AcceptedRow,
  acceptedRows,
  fromServerNote,
  markOnServer,
  reconcileAttachments,
  settle,
  transferOf,
  wireNote,
  wireRow,
  withReceived,
} from '../syncRows.ts';
import type { NotesDB } from './db.ts';
import { live } from './live.ts';

/** The Dexie store's `sync` half: what the server is owed, and writing what it answers. */
export function createDexieSync(db: NotesDB): LocalStore['sync'] {
  const synced = [db.notes, db.tags, db.noteTags, db.attachments, db.tombstones];

  return {
    dirty: () =>
      db.transaction(
        'r',
        [db.notes, db.tags, db.noteTags, db.attachments, db.tombstones],
        async () => {
          const [notes, tags, noteTags, tombstones] = await Promise.all([
            db.notes.where('dirty').equals(1).toArray(),
            db.tags.where('dirty').equals(1).toArray(),
            db.noteTags.where('dirty').equals(1).toArray(),
            db.tombstones.toArray(),
          ]);
          const attachments = await db.attachments
            .where('noteId')
            .anyOf(notes.map((n) => n.id))
            .toArray();
          return {
            notes: notes.map((n) =>
              wireNote(
                n,
                attachments.filter((a) => a.noteId === n.id)
              )
            ),
            tags: tags.map(wireRow),
            noteTags: noteTags.map(wireRow),
            tombstones,
          };
        }
      ),
    applied: async (batch, outcomes) => {
      const accepted = acceptedRows(batch, outcomes);
      return db.transaction(
        'rw',
        [db.notes, db.tags, db.noteTags, db.attachments, db.tombstones],
        async () => {
          /** Removed while the push was in flight: its Tombstone must carry the new Revision. */
          const rebase = async (id: string, a: AcceptedRow) => {
            const gone = await db.tombstones.get(id);
            if (gone && gone.rev === a.row.rev) await db.tombstones.put({ ...gone, rev: a.rev });
          };
          for (const a of accepted) {
            if (a.kind === 'tombstone') {
              await db.tombstones.delete(a.row.id);
            } else if (a.kind === 'note') {
              const stored = await db.notes.get(a.row.id);
              if (!stored) await rebase(a.row.id, a);
              else {
                const attachments = await db.attachments.where('noteId').equals(a.row.id).toArray();
                await db.notes.put(settle(stored, wireNote(stored, attachments), a));
              }
            } else if (a.kind === 'tag') {
              const stored = await db.tags.get(a.row.id);
              if (!stored) await rebase(a.row.id, a);
              else await db.tags.put(settle(stored, wireRow(stored), a));
            } else {
              const { noteId, tagId } = a.row;
              const stored = await db.noteTags.get([noteId, tagId]);
              if (!stored) await rebase(noteTagId(noteId, tagId), a);
              else await db.noteTags.put(settle(stored, wireRow(stored), a));
            }
          }
        }
      );
    },

    applyPage: (changes, mode = 'keep-local') =>
      db.transaction('rw', synced, async () => {
        /** In a pull, a row this Device still owes (or has purged) waits for its push. */
        const keepLocal = async (owed: boolean, id: string) =>
          mode === 'keep-local' && (owed || (await db.tombstones.get(id)) !== undefined);

        for (const row of changes.notes) {
          if (await keepLocal((await db.notes.get(row.id))?.dirty === 1, row.id)) continue;
          await db.notes.put(fromServerNote(row));
          await db.tombstones.delete(row.id);
          if (!row.attachments) continue;
          const local = await db.attachments.where('noteId').equals(row.id).toArray();
          const { put, remove } = reconcileAttachments(row.attachments, local);
          await db.attachments.bulkDelete(remove);
          await db.attachments.bulkPut(put);
        }
        for (const row of changes.tags) {
          if (await keepLocal((await db.tags.get(row.id))?.dirty === 1, row.id)) continue;
          await db.tags.put({ ...row });
          await db.tombstones.delete(row.id);
        }
        for (const row of changes.noteTags) {
          const id = noteTagId(row.noteId, row.tagId);
          const stored = await db.noteTags.get([row.noteId, row.tagId]);
          if (await keepLocal(stored?.dirty === 1, id)) continue;
          await db.noteTags.put({ ...row });
          await db.tombstones.delete(id);
        }
        for (const gone of changes.tombstones) {
          await db.tombstones.delete(gone.id);
          if (gone.kind === 'note') {
            await db.notes.delete(gone.id);
            await db.noteTags.where('noteId').equals(gone.id).delete();
            await db.attachments.where('noteId').equals(gone.id).delete();
          } else if (gone.kind === 'tag') {
            await db.tags.delete(gone.id);
            await db.noteTags.where('tagId').equals(gone.id).delete();
          } else {
            const pair = parseNoteTagId(gone.id);
            if (pair) await db.noteTags.delete([pair.noteId, pair.tagId]);
          }
        }
      }),

    resetClean: () =>
      db.transaction('rw', [db.notes, db.tags, db.noteTags], async () => {
        await db.notes.filter((row) => row.dirty !== 1).delete();
        await db.tags.filter((row) => row.dirty !== 1).delete();
        await db.noteTags.filter((row) => row.dirty !== 1).delete();
      }),

    adoptAll: () =>
      db.transaction('rw', [db.notes, db.tags, db.noteTags, db.tombstones], async () => {
        const owe = (row: { rev?: number; dirty?: 1 }) => {
          row.dirty = 1;
          delete row.rev;
        };
        await db.notes.toCollection().modify(owe);
        await db.tags.toCollection().modify(owe);
        await db.noteTags.toCollection().modify(owe);
        await db.tombstones.clear();
      }),

    pending: () =>
      live(async () => {
        const counts = await Promise.all([
          db.notes.where('dirty').equals(1).count(),
          db.tags.where('dirty').equals(1).count(),
          db.noteTags.where('dirty').equals(1).count(),
          db.tombstones.count(),
        ]);
        return counts.reduce((sum, n) => sum + n, 0);
      }),

    transfers: () =>
      db.transaction('r', db.notes, db.attachments, async () => {
        const rows = await db.attachments.toArray();
        const notes = await db.notes.bulkGet([...new Set(rows.map((row) => row.noteId))]);
        const known = new Set(notes.flatMap((n) => (n?.rev === undefined ? [] : [n.id])));
        return rows.map((row) => transferOf(row, known.has(row.noteId)));
      }),
    onServer: (id, blobId) =>
      db.transaction('rw', db.attachments, async () => {
        const row = await db.attachments.get(id);
        if (row) await db.attachments.put(markOnServer(row, blobId));
      }),
    tooLarge: async (id) => {
      await db.attachments.update(id, { tooLarge: 1 });
    },
    received: (id, bytes) =>
      db.transaction('rw', db.attachments, async () => {
        const row = await db.attachments.get(id);
        if (row) await db.attachments.put(withReceived(row, bytes));
      }),
  };
}
