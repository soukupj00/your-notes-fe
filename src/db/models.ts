export interface Note {
  id: string; // Unique ID (UUID or nanoid)
  header?: string; // Optional title
  description?: string; // Optional description
  checklist: string[]; // Checklist items
  audio?: NoteAudio[]; // Array of audio attachments
  images?: NoteImage[]; // Array of images
  files?: NoteFile[]; // Array of file attachments
  tags?: Tag[]; // Array of tags
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

export interface Tag {
  id: string; // Unique ID for tag
  name: string; // Tag name (e.g., "Work", "Personal")
}

export interface NoteTag {
  noteId: string; // Foreign key to Note.id
  tagId: string; // Foreign key to Tag.id
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
}

export interface NoteAudio {
  id: string;
  noteId: string;
  url: string; // Audio file URL or Base64 string
  name?: string; // Optional audio name
  duration?: number; // Duration in seconds
}

export interface NoteFile {
  id: string;
  noteId: string;
  url: string; // File URL or Base64
  name: string; // Original filename
  size?: number; // File size in bytes
  type?: string; // MIME type
}
