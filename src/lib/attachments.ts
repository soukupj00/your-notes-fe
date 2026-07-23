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

/** Video MIME types accepted for attachment. */
export const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
] as const;

/** Per-video size cap: 100 MB. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Per-file size cap: 50 MB. Generous relative to media caps because a file
 *  attachment can be any document (PDFs, archives, ...). Adjustable. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Excalidraw scenes are stored as a JSON document (reuses the Blob-based attachments table). */
export const EXCALIDRAW_MIME = 'application/json';

/** Per-scene size cap: 25 MB. Enforced at creation only. */
export const MAX_EXCALIDRAW_BYTES = 25 * 1024 * 1024;

/** Kind-dispatched file validation. Returns the failure code or null. Pure. */
export function validateAttachmentFile(
  file: File,
  kind: AttachmentKind
): AttachmentErrorCode | null {
  if (kind === 'image') {
    return validateImageFile(file);
  }
  if (kind === 'audio') {
    // MediaRecorder output (recorder output is always allowed) carries a codec
    // param, e.g. 'audio/webm;codecs=opus' - strip it before the whitelist
    // check so an exact-match comparison doesn't reject a valid base type.
    const baseType = file.type.split(';')[0].trim();
    if (!ALLOWED_AUDIO_MIME.includes(baseType as (typeof ALLOWED_AUDIO_MIME)[number])) {
      return 'unsupported-type';
    }
    if (file.size > MAX_AUDIO_BYTES) return 'too-large';
    return null;
  }
  if (kind === 'video') {
    // Same codec-suffix stripping as audio, e.g. 'video/mp4;codecs=avc1'.
    const baseType = file.type.split(';')[0].trim();
    if (!ALLOWED_VIDEO_MIME.includes(baseType as (typeof ALLOWED_VIDEO_MIME)[number])) {
      return 'unsupported-type';
    }
    if (file.size > MAX_VIDEO_BYTES) return 'too-large';
    return null;
  }
  if (kind === 'file') {
    // No MIME whitelist: a file attachment accepts any type. Only the size cap
    // gates it (unlike image/audio/video, which whitelist their MIME).
    if (file.size > MAX_FILE_BYTES) return 'too-large';
    return null;
  }
  if (kind === 'excalidraw') {
    if (file.type.split(';')[0].trim() !== EXCALIDRAW_MIME) return 'unsupported-type';
    if (file.size > MAX_EXCALIDRAW_BYTES) return 'too-large';
    return null;
  }
  // file kind lands in a later slice; reject until then.
  return 'unsupported-type';
}
