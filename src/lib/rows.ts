import type { Attachment, AttachmentKind, Note, NoteTag, Tag } from '@/models.ts';

// Ids and birth timestamps are the caller's, never the store's (src/data/CLAUDE.md), so every row
// is born here. A secure context is already required (ADR 0018), so randomUUID is safe.
export const mintId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/**
 * The one place that knows a Note's defaults. An id may be supplied because it enters the URL when
 * the editor opens (ADR 0014); `trashedAt` passes through for the purge sweep to key off.
 */
export function newNote(data: Partial<Note>, now = nowIso()): Note {
  return {
    id: data.id ?? mintId(),
    header: data.header ?? '',
    description: data.description ?? '',
    body: data.body ?? '',
    state: data.state ?? 'active',
    pinnedAt: data.pinnedAt,
    color: data.color,
    trashedAt: data.trashedAt,
    remindAt: data.remindAt,
    repeat: data.repeat,
    createdAt: now,
    updatedAt: now,
  };
}

export function newTag(name: string, color?: string, now = nowIso()): Tag {
  return { id: mintId(), name, color, createdAt: now, updatedAt: now };
}

export function newNoteTag(noteId: string, tagId: string, now = nowIso()): NoteTag {
  return { noteId, tagId, createdAt: now, updatedAt: now };
}

export type NewAttachmentOptions = {
  thumbnail?: Blob;
  duration?: number;
  width?: number;
  height?: number;
};

/** `file` is already validated (`lib/attachments.ts`); a File is a Blob and is stored as is (ADR 0007). */
export function newAttachment(
  noteId: string,
  file: File,
  kind: AttachmentKind,
  options: NewAttachmentOptions = {},
  now = nowIso()
): Attachment {
  return {
    id: mintId(),
    noteId,
    kind,
    mime: file.type,
    blob: file,
    thumbnail: options.thumbnail,
    // The thumbnail's own blob id on the server, so it syncs ahead of the full bytes.
    thumbnailId: options.thumbnail ? mintId() : undefined,
    duration: options.duration,
    width: options.width,
    height: options.height,
    name: file.name,
    size: file.size,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A new row under `noteId` with the source's metadata and full bytes. Every row has one owner and
 * bytes are write-once by id (ADR 0017), so a copy is a new id; the thumbnail and its id stay
 * shared with the source. A source without bytes yields a clone that waits for them the same way.
 */
export function cloneAttachment(source: Attachment, noteId: string, now = nowIso()): Attachment {
  return {
    ...source,
    id: mintId(),
    noteId,
    blob: source.blob?.slice(0, source.blob.size, source.blob.type),
    createdAt: now,
    updatedAt: now,
  };
}
