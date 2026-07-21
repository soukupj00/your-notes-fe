export interface Note {
  id: string; // Unique ID (UUID or nanoid)
  header?: string; // Optional title
  description?: string; // Optional plaintext subtitle (dormant until a later milestone gives it UI)
  body?: string; // Rich-text HTML from the editor (see "Body" in CONTEXT.md)
  checklist: string[]; // Checklist items
  audio?: NoteAudio[]; // Array of audio attachments
  images?: NoteImage[]; // Array of images
  files?: NoteFile[]; // Array of file attachments
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

/**
 * Media models (1:N with Note)
 * Each Note can have multiple images, audio, files
 */
export interface NoteImage {
  id: string; // Unique ID
  noteId: string; // FK to Note.id
  url: string; // Object URL or Base64 string
  name?: string; // Optional image name
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export interface NoteAudio {
  id: string;
  noteId: string;
  url: string; // Audio file URL or Base64 string
  name?: string; // Optional audio name
  duration?: number; // Duration in seconds
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}

export interface NoteFile {
  id: string;
  noteId: string;
  url: string; // File URL or Base64
  name: string; // Original filename
  size?: number; // File size in bytes
  type?: string; // MIME type
  createdAt: string; // Timestamp
  updatedAt: string; // Timestamp
}
