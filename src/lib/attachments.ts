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

export type AttachmentErrorCode = 'unsupported-type' | 'too-large';

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
