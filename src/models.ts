/**
 * The single lifecycle stage a Note occupies (ADR 0009). Mutually exclusive -
 * a Note is never two of these at once. Pinning is modelled separately
 * (`Note.pinnedAt`) because it is orthogonal to the stage.
 */
export type NoteState = 'active' | 'archived' | 'trashed';

export interface Note {
  id: string; // Unique ID (UUID or nanoid)
  header?: string; // Optional title
  description?: string; // Optional plaintext subtitle (dormant until a later milestone gives it UI)
  body?: string; // Rich-text HTML from the editor (see "Body" in CONTEXT.md)
  state: NoteState; // Lifecycle stage; every row carries one (Dexie v3 stamps legacy rows 'active')
  pinnedAt?: string; // ISO; presence = pinned, value orders pinned notes. Cleared on archive/trash
  color?: string; // NoteColor token key (see lib/note-colors.ts), never a raw color value
  trashedAt?: string; // ISO; set on entry to trash, drives the 30-day purge sweep
  tags?: Tag[]; // Array of tags
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export interface Tag {
  id: string; // Unique ID for tag
  name: string; // Tag name (e.g., "Work", "Personal")
  color?: string; // NoteColor token key, shared palette with Note.color
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export interface NoteTag {
  noteId: string; // Foreign key to Note.id
  tagId: string; // Foreign key to Tag.id
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export type AttachmentKind = 'image' | 'audio' | 'video' | 'file' | 'excalidraw'; // grows per slice

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
  blob: Blob; // the authoritative full-size bytes
  thumbnail?: Blob; // image: downscaled WebP Preview for cheap card rendering
  name?: string; // original filename
  size?: number; // bytes
  width?: number; // image/video (computed in a later processing slice)
  height?: number; // image/video
  duration?: number; // audio/video (later slices)
  preview?: string; // excalidraw: rendered SVG snapshot of the scene, stored at save-time for cheap card rendering (no canvas re-mount)
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
