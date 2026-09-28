import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';

// Mutations close over the store from context, which the provider creates
// once, so they are memoized on it alone - the editor's insert handlers and
// the dialog's autosave depend on stable identities (see useNoteActions for
// the same rationale).
export function useAttachmentActions() {
  const store = useLocalStore();

  const createAttachment = useCallback(
    async (
      noteId: string,
      file: File,
      kind: AttachmentKind = 'image',
      options: { thumbnail?: Blob; duration?: number; width?: number; height?: number } = {}
    ): Promise<Attachment> => {
      const bad = validateAttachmentFile(file, kind);
      if (bad) throw new AttachmentError(bad);
      const now = new Date().toISOString();
      const att: Attachment = {
        id: uuid(),
        noteId,
        kind,
        mime: file.type,
        blob: file, // a File is a Blob; persist directly (ADR 0007)
        thumbnail: options.thumbnail,
        // The thumbnail's own blob id on the server (M5 slice 5): it syncs ahead of the bytes.
        thumbnailId: options.thumbnail ? uuid() : undefined,
        duration: options.duration,
        width: options.width,
        height: options.height,
        name: file.name,
        size: file.size,
        createdAt: now,
        updatedAt: now,
      };
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
      const now = new Date().toISOString();
      const clone: Attachment = {
        ...source,
        id: uuid(),
        noteId,
        // A row not downloaded here has no bytes to copy; the clone waits for them the same way.
        blob: source.blob?.slice(0, source.blob.size, source.blob.type),
        createdAt: now,
        updatedAt: now,
      };
      await store.attachments.add(clone);
      return clone;
    },
    [store]
  );

  // Write-back for an attachment's derived data, on the same row the Body
  // already references by id. Two callers: Excalidraw stores the SVG preview on
  // the row a Save just minted (a Save never rewrites bytes; see
  // Excalidraw/commit.ts); the card backfills a poster and duration onto a
  // video stored before posters were captured at insert.
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
          ? { ...changes, thumbnail, thumbnailId: uuid(), updatedAt }
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

  // Startup GC: the saved Body is authoritative because no editor undo stack
  // survives a reload. Reconcile every live Note as well as missing owners.
  //
  // One pass over both tables rather than the note-scoped sweep per note: the
  // missing-owner and unreferenced-row cases are the same question asked of one
  // row ("is anything still pointing at this?"), and answering them together
  // costs one transaction instead of a full attachments read plus one indexed
  // read and one transaction per note, on every app start.
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
