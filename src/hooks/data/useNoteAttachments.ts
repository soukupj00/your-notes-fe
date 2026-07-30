import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/db.ts';
import type { Attachment } from '@/models.ts';

/**
 * Every attachment row owned by a note, keyed by id.
 *
 * A Map rather than an array because the caller already knows the order and the
 * kinds - it read them out of the Body - and only needs the bytes and metadata
 * to join onto them. Live, so a drawing re-saved in the editor refreshes its
 * card preview without a feed reload.
 */
export function useNoteAttachments(noteId: string): Map<string, Attachment> {
  const rows = useLiveQuery(
    async () => (noteId ? db.attachments.where('noteId').equals(noteId).toArray() : []),
    [noteId]
  );

  // Stable between query results on purpose: the card mints object URLs from
  // these rows, and a fresh Map on every render would re-mint - and visibly
  // flicker - every thumbnail in the feed.
  return useMemo(() => new Map((rows ?? []).map((row) => [row.id, row])), [rows]);
}
