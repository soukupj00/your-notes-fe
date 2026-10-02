import { useMemo, useState } from 'react';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';
import type { Attachment } from '@/models.ts';

/** The rows a card joins onto the attachment references it read from the Body. */
export type NoteAttachments = Map<string, Attachment>;

// Module-level, so a note with no id gets a Live that delivers once and never again.
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
 * A note's attachment rows by id: the caller already read order and kinds from the Body.
 * `noteId` is nullable so a caller that has the rows, or has none in its Body, skips the query.
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
 * The same join for a whole feed, as one live query. A note with unchanged rows keeps its exact
 * Map, or any attachment write would re-mint every thumbnail on screen (src/hooks/data/CLAUDE.md).
 */
export function useAttachmentsByNote(noteIds: readonly string[]): Map<string, NoteAttachments> {
  const store = useLocalStore();
  // The query depends on which notes are on screen, and an array literal would
  // re-subscribe on every render.
  const key = noteIds.join(' ');

  const rows = useLive(() => store.attachments.forNotes(noteIds), [store, key]);

  // State, not a ref: the lint rules forbid `ref.current` in render, and this table is read while
  // the Map is built. Mutating it in render is safe: it is a content-keyed memo, so a repeated
  // render (StrictMode) returns an equal Map.
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
