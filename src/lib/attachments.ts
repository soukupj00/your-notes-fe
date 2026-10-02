import type { AttachmentKind } from '@/models.ts';

/** What a kind is, in one row: how a picked or dropped file is matched to it, what it accepts,
 *  how big it may be, the Body tag the editor writes for it, and the extensions its files get. */
export interface AttachmentSpec {
  /** `file.type` prefix a transfer or a pick must match. `''` matches every file; `null` means
   *  the kind never arrives as a file (a Drawing is made in the app). */
  prefix: string | null;
  /** Allowed base MIME types (a `;codecs=` parameter is ignored); `null` accepts any type. */
  mimes: readonly string[] | null;
  maxBytes: number;
  /** The tag the editor serialises the kind's node as, carrying `data-attachment-id`. */
  tag: string;
  /** File extension by base MIME, for the files the app names itself. */
  extensions: Readonly<Record<string, string>>;
  /** The picker's `accept`: a wildcard, not the whitelist. Android offers the camera only for
   *  the wildcard, and Chrome on Linux greys out valid files when specific types are listed;
   *  the whitelist is enforced by `validateAttachmentFile` after the pick. */
  accept?: string;
}

export const MiB = 1024 * 1024;

export const ATTACHMENT_SPECS: Record<AttachmentKind, AttachmentSpec> = {
  image: {
    prefix: 'image/',
    // SVG is excluded because it can carry script.
    mimes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'],
    maxBytes: 10 * MiB,
    tag: 'img',
    extensions: {},
    accept: 'image/*',
  },
  audio: {
    prefix: 'audio/',
    // Must include every candidate the in-app recorder can pick (pinned in attachments.test.ts).
    mimes: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav'],
    maxBytes: 25 * MiB,
    tag: 'audio',
    extensions: {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    },
  },
  video: {
    prefix: 'video/',
    mimes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    maxBytes: 100 * MiB,
    tag: 'video',
    extensions: {},
    accept: 'video/*',
  },
  file: {
    prefix: '',
    // Any document, so no whitelist; the cap is the only gate.
    mimes: null,
    maxBytes: 50 * MiB,
    tag: 'a',
    extensions: {},
  },
  excalidraw: {
    prefix: null,
    // The scene is a JSON Blob in the same table; the cap is enforced at creation only.
    mimes: ['application/json'],
    maxBytes: 25 * MiB,
    tag: 'excalidraw-drawing',
    extensions: { 'application/json': 'excalidraw.json' },
  },
};

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

/** The MIME without its parameters: recorder output may carry `;codecs=opus`. */
export function baseMimeType(mime: string): string {
  return mime.split(';')[0].trim();
}

/** Whether a picked or dropped file belongs to the kind. */
export function fileMatchesKind(file: File, kind: AttachmentKind): boolean {
  const prefix = ATTACHMENT_SPECS[kind].prefix;
  return prefix !== null && file.type.startsWith(prefix);
}

export function validateAttachmentFile(
  file: File,
  kind: AttachmentKind
): AttachmentErrorCode | null {
  // A kind this build does not know (a row from a newer Device) has no contract yet; `hasOwn`
  // because a plain object also resolves inherited names such as `constructor`.
  if (!Object.hasOwn(ATTACHMENT_SPECS, kind)) return 'unsupported-type';
  const spec = ATTACHMENT_SPECS[kind];
  if (spec.mimes && !spec.mimes.includes(baseMimeType(file.type))) return 'unsupported-type';
  if (file.size > spec.maxBytes) return 'too-large';
  return null;
}

/** The extension a file of this kind gets when the app names it, such as a recording. */
export function fileExtension(kind: AttachmentKind, mime: string): string | undefined {
  return ATTACHMENT_SPECS[kind].extensions[baseMimeType(mime)];
}
