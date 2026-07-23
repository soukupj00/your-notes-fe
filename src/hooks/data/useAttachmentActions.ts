import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';

// Mutations close over the stable `db` import only, so they are memoized with
// empty deps - the editor's insert handlers and the dialog's autosave depend on
// stable identities (see useNoteActions for the same rationale).
export function useAttachmentActions() {
  const createAttachment = useCallback(
    async (noteId: string, file: File, kind: AttachmentKind = 'image'): Promise<Attachment> => {
      const bad = validateAttachmentFile(file, kind);
      if (bad) throw new AttachmentError(bad);
      const now = new Date().toISOString();
      const att: Attachment = {
        id: uuid(),
        noteId,
        kind,
        mime: file.type,
        blob: file, // a File is a Blob; persist directly (ADR 0007)
        name: file.name,
        size: file.size,
        createdAt: now,
        updatedAt: now,
      };
      await db.attachments.add(att);
      return att;
    },
    []
  );

  const getAttachment = useCallback((id: string) => db.attachments.get(id), []);

  const deleteAttachment = useCallback(async (id: string) => {
    await db.attachments.delete(id);
  }, []);

  const cloneAttachment = useCallback(
    async (source: Attachment, noteId: string): Promise<Attachment> => {
      const now = new Date().toISOString();
      const clone: Attachment = {
        ...source,
        id: uuid(),
        noteId,
        blob: source.blob.slice(0, source.blob.size, source.blob.type),
        createdAt: now,
        updatedAt: now,
      };
      await db.attachments.add(clone);
      return clone;
    },
    []
  );

  // Write-back for interactive attachments (Excalidraw): replace the stored
  // scene blob and/or refresh the SVG preview in place, on the same row the
  // Body already references by id. Decoupled from Body autosave (the
  // attachmentId never changes on an edit).
  const updateAttachment = useCallback(
    async (id: string, changes: { blob?: Blob; preview?: string }): Promise<void> => {
      await db.attachments.update(id, { ...changes, updatedAt: new Date().toISOString() });
    },
    []
  );

  // Note-scoped GC: drop this note's rows no longer referenced by the saved Body.
  const collectOrphans = useCallback(async (noteId: string, referencedIds: string[]) => {
    const referenced = new Set(referencedIds);
    return db.transaction('rw', db.attachments, async () => {
      const rows = await db.attachments.where('noteId').equals(noteId).toArray();
      const orphans = rows.filter((r) => !referenced.has(r.id));
      await db.attachments.bulkDelete(orphans.map((r) => r.id));
      return orphans.length;
    });
  }, []);

  // Global safety net: drop rows whose owning Note no longer exists (covers a
  // draft that was discarded before it was ever persisted, or a crash).
  const collectMissingNoteOrphans = useCallback(async () => {
    return db.transaction('rw', db.notes, db.attachments, async () => {
      const noteIds = new Set(await db.notes.toCollection().primaryKeys());
      const all = await db.attachments.toArray();
      const orphans = all.filter((r) => !noteIds.has(r.noteId));
      await db.attachments.bulkDelete(orphans.map((r) => r.id));
      return orphans.length;
    });
  }, []);

  return {
    createAttachment,
    getAttachment,
    deleteAttachment,
    cloneAttachment,
    updateAttachment,
    collectOrphans,
    collectMissingNoteOrphans,
  };
}
