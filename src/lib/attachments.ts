import type { AttachmentKind } from '@/models.ts';

/** SVG is excluded because it can carry script. */
export const ALLOWED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type AttachmentErrorCode = 'unsupported-type' | 'too-large' | 'insert-failed';

/** Carries a code so the caller can map a failed attachment to a translated toast. */
export class AttachmentError extends Error {
  code: AttachmentErrorCode;

  constructor(code: AttachmentErrorCode) {
    super(code);
    this.name = 'AttachmentError';
    this.code = code;
  }
}

export function validateImageFile(file: File): AttachmentErrorCode | null {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
    return 'unsupported-type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'too-large';
  }
  return null;
}

/** Must include every `CANDIDATE_MIME` the in-app recorder (`useAudioRecorder`) can pick. */
const ALLOWED_AUDIO_MIME = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
] as const;

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'] as const;

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Larger than the media caps because a file can be any document (PDFs, archives). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** An Excalidraw scene is stored as a JSON Blob in the same attachments table. */
const EXCALIDRAW_MIME = 'application/json';

/** Enforced at creation only. */
export const MAX_EXCALIDRAW_BYTES = 25 * 1024 * 1024;

function baseMimeType(file: File): string {
  return file.type.split(';')[0].trim();
}

function validateWhitelistedFile(
  file: File,
  allowedMimeTypes: readonly string[],
  maxBytes: number
): AttachmentErrorCode | null {
  if (!allowedMimeTypes.includes(baseMimeType(file))) return 'unsupported-type';
  if (file.size > maxBytes) return 'too-large';
  return null;
}

export function validateAttachmentFile(
  file: File,
  kind: AttachmentKind
): AttachmentErrorCode | null {
  if (kind === 'image') {
    return validateImageFile(file);
  }
  if (kind === 'audio') {
    // Recorder output may carry a codec parameter, e.g. audio/webm;codecs=opus.
    return validateWhitelistedFile(file, ALLOWED_AUDIO_MIME, MAX_AUDIO_BYTES);
  }
  if (kind === 'video') {
    return validateWhitelistedFile(file, ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES);
  }
  if (kind === 'file') {
    // Deliberately no MIME whitelist: a file attachment can be any type.
    if (file.size > MAX_FILE_BYTES) return 'too-large';
    return null;
  }
  if (kind === 'excalidraw') {
    return validateWhitelistedFile(file, [EXCALIDRAW_MIME], MAX_EXCALIDRAW_BYTES);
  }
  // Reject unknown future kinds until their validation contract is defined.
  return 'unsupported-type';
}
