import { useMemo, useState } from 'react';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';
import type { Attachment } from '@/models.ts';

/** The rows a card joins onto the attachment references it read from the Body. */
export type NoteAttachments = Map<string, Attachment>;

// Module-level, so a note with no id gets a Live that delivers once and never again:
const EMPTY_ROWS = emptyLive<Attachment[]>([]);

/**
 * Identifies a note's rows by content, so an unchanged note can keep its Map.
 * Which bytes a row holds is part of it: Sync writes a downloaded thumbnail or
 * blob without touching `updatedAt` (it is not an edit), and the card has to see it.
 */
function signatureOf(rows: Attachment[]): string {
  return rows
    .map((row) => `${row.id}@${row.updatedAt}${row.blob ? '+b' : ''}${row.thumbnail ? '+t' : ''}`)
    .sort()
    .join('|');
}

function toMap(rows: Attachment[]): NoteAttachments {
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Every attachment row owned by a note, keyed by id.
 *
 * A Map rather than an array because the caller already knows the order and the
 * kinds - it read them out of the Body - and only needs the bytes and metadata
 * to join onto them. Live, so a drawing re-saved in the editor refreshes its
 * card preview without a feed reload.
 *
 * `noteId` is nullable so a caller that has the rows already - or whose Body
 * references no attachment at all - can skip the query outright, the same way
 * `useTagsForNote` lets the feed pre-join labels.
 */
export function useNoteAttachments(noteId: string | null): NoteAttachments {
  const store = useLocalStore();
  const rows = useLive(
    () => (noteId ? store.attachments.forNote(noteId) : EMPTY_ROWS),
    [store, noteId]
  );

  // Stable between query results on purpose: the card mints object URLs from
  // these rows, and a fresh Map on every render would re-mint - and visibly
  // flicker - every thumbnail in the feed.
  return useMemo(() => toMap(rows ?? []), [rows]);
}

/**
 * The same join for a whole feed, as one live query instead of one per card.
 *
 * The reason this is not simply "group the rows" is identity. A single query
 * refires for *any* attachment write, so a naive grouping would hand every card
 * a brand-new Map each time one drawing was saved - and `CardMedia` mints its
 * object URLs off that Map, so every thumbnail on screen would be revoked and
 * re-minted, which reads as the whole feed flickering.
 *
 * So a note whose rows are unchanged keeps the exact Map (and the exact row
 * objects) it was given before, and only the note that actually changed gets a
 * new one. `useNoteAttachments.test.ts` locks that guarantee down; without it
 * this hook is a visible regression rather than an optimisation.
 */
export function useAttachmentsByNote(noteIds: readonly string[]): Map<string, NoteAttachments> {
  const store = useLocalStore();
  // The query depends on which notes are on screen, and an array literal would
  // re-subscribe on every render.
  const key = noteIds.join(' ');

  const rows = useLive(() => store.attachments.forNotes(noteIds), [store, key]);

  /*
   * The signature table, held in state rather than in a ref.
   *
   * `useState` with a lazy initialiser is the same thing a ref would be - one
   * mutable instance created once and owned by this hook - but `react-hooks`
   * (v7, compiler-grade) forbids touching `ref.current` during render, and this
   * table has to be consulted *while* the Map is being built. A ref would need
   * an effect, which is a commit too late: the Map is the render's own output.
   *
   * Mutating it in render is sound because the table is a pure memo keyed by
   * content, not state the UI reads. Running the block twice with the same rows
   * (StrictMode, a discarded concurrent render) mints on the first pass and hits
   * the cache on the second, so the result is identical both times - the table
   * only ever decides *which* equal Map you get back, never what is in it.
   */
  const [cache] = useState(
    () => new Map<string, { signature: string; attachments: NoteAttachments }>()
  );

  return useMemo(() => {
    const grouped = new Map<string, Attachment[]>();
    for (const row of rows ?? []) {
      const list = grouped.get(row.noteId);
      if (list) list.push(row);
      else grouped.set(row.noteId, [row]);
    }

    const result = new Map<string, NoteAttachments>();
    for (const [noteId, list] of grouped) {
      const signature = signatureOf(list);
      const previous = cache.get(noteId);
      // Same rows as last time: hand back the previous Map so the card's memos
      // hold and its object URLs survive a write to some *other* note.
      const attachments = previous?.signature === signature ? previous.attachments : toMap(list);
      cache.set(noteId, { signature, attachments });
      result.set(noteId, attachments);
    }

    for (const noteId of cache.keys()) {
      if (!grouped.has(noteId)) cache.delete(noteId);
    }

    return result;
  }, [rows, cache]);
}
