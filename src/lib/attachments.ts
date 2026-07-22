import type { AttachmentKind } from '@/models.ts';

/** Image MIME types we accept in Slice 1. SVG excluded (script surface). */
export const ALLOWED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
] as const;

/** Per-image size cap: 10 MB. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type AttachmentErrorCode = 'unsupported-type' | 'too-large' | 'insert-failed';

/** Thrown by createAttachment when a file fails validation; carries a code so
 *  the caller can map it to a translated toast. */
export class AttachmentError extends Error {
  code: AttachmentErrorCode;

  constructor(code: AttachmentErrorCode) {
    super(code);
    this.name = 'AttachmentError';
    this.code = code;
  }
}

/** Returns the failure code, or null when the file is a valid image. Pure. */
export function validateImageFile(file: File): AttachmentErrorCode | null {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
    return 'unsupported-type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'too-large';
  }
  return null;
}

/** Audio MIME types accepted for attachment (recorder output is always allowed). */
export const ALLOWED_AUDIO_MIME = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
] as const;

/** Per-audio size cap: 25 MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Kind-dispatched file validation. Returns the failure code or null. Pure. */
export function validateAttachmentFile(
  file: File,
  kind: AttachmentKind
): AttachmentErrorCode | null {
  if (kind === 'image') {
    return validateImageFile(file);
  }
  if (kind === 'audio') {
    if (!ALLOWED_AUDIO_MIME.includes(file.type as (typeof ALLOWED_AUDIO_MIME)[number])) {
      return 'unsupported-type';
    }
    if (file.size > MAX_AUDIO_BYTES) return 'too-large';
    return null;
  }
  // video/file kinds land in later slices; reject until then.
  return 'unsupported-type';
}
