import { useCallback } from 'react';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';
import {
  cloneAttachment as cloneRow,
  mintId,
  type NewAttachmentOptions,
  newAttachment,
} from '@/lib/rows.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';

// Memoized on the store alone, which the provider creates once: the editor's insert handlers and
// the dialog's autosave depend on stable identities.
export function useAttachmentActions() {
  const store = useLocalStore();

  const createAttachment = useCallback(
    async (
      noteId: string,
      file: File,
      kind: AttachmentKind = 'image',
      options: NewAttachmentOptions = {}
    ): Promise<Attachment> => {
      const bad = validateAttachmentFile(file, kind);
      if (bad) throw new AttachmentError(bad);
      const att = newAttachment(noteId, file, kind, options);
      await store.attachments.add(att);
      return att;
    },
    [store]
  );

  const getAttachment = useCallback((id: string) => store.attachments.get(id), [store]);

  /** The row, live: a download or a pull re-renders whatever shows it. */
  const watchAttachment = useCallback((id: string) => store.attachments.watch(id), [store]);

  const deleteAttachment = useCallback((id: string) => store.attachments.delete(id), [store]);

  const cloneAttachment = useCallback(
    async (source: Attachment, noteId: string): Promise<Attachment> => {
      const clone = cloneRow(source, noteId);
      await store.attachments.add(clone);
      return clone;
    },
    [store]
  );

  // Derived data written back onto the row the Body already references. Callers: Excalidraw's SVG
  // preview on the row a Save just minted (Excalidraw/commit.ts), and the card backfilling a poster
  // and duration onto a video stored before posters were captured.
  const updateAttachment = useCallback(
    (
      id: string,
      { thumbnail, ...changes }: { preview?: string; thumbnail?: Blob; duration?: number }
    ) => {
      const updatedAt = new Date().toISOString();
      // New thumbnail bytes are a new blob: bytes are write-once by id (ADR 0017).
      return store.attachments.update(
        id,
        thumbnail
          ? { ...changes, thumbnail, thumbnailId: mintId(), updatedAt }
          : { ...changes, updatedAt }
      );
    },
    [store]
  );

  // Note-scoped GC: drop this note's rows no longer referenced by the saved Body.
  const collectOrphans = useCallback(
    (noteId: string, referencedIds: string[]) => store.attachments.sweepNote(noteId, referencedIds),
    [store]
  );

  // Startup GC, where the saved Body is authoritative because no editor undo stack survives a
  // reload. One pass over both tables, not a sweep per note: see src/hooks/data/CLAUDE.md.
  const collectStartupOrphans = useCallback(
    () => store.attachments.sweepAll((note) => extractAttachmentIds(note.body)),
    [store]
  );

  return {
    createAttachment,
    getAttachment,
    watchAttachment,
    deleteAttachment,
    cloneAttachment,
    updateAttachment,
    collectOrphans,
    collectStartupOrphans,
  };
}
