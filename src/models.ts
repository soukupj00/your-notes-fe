export interface Note {
  id: string; // Unique ID (UUID or nanoid)
  header?: string; // Optional title
  description?: string; // Optional plaintext subtitle (dormant until a later milestone gives it UI)
  body?: string; // Rich-text HTML from the editor (see "Body" in CONTEXT.md)
  checklist: string[]; // Checklist items
  tags?: Tag[]; // Array of tags
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export interface Tag {
  id: string; // Unique ID for tag
  name: string; // Tag name (e.g., "Work", "Personal")
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export interface NoteTag {
  noteId: string; // Foreign key to Note.id
  tagId: string; // Foreign key to Tag.id
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file'; // grows per slice

/**
 * A binary attachment (starting with inline images in M3 Slice 1). Bytes live
 * here as a native Blob (ADR 0007); the Note body references it by id via
 * <img data-attachment-id>. One row is owned by exactly one Note (noteId).
 */
export interface Attachment {
  id: string; // uuid v4
  noteId: string; // FK to Note.id
  kind: AttachmentKind;
  mime: string; // e.g. 'image/png'
  blob: Blob; // the bytes
  name?: string; // original filename
  size?: number; // bytes
  width?: number; // image/video (computed in a later processing slice)
  height?: number; // image/video
  duration?: number; // audio/video (later slices)
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
