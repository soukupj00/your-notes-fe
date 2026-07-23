import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import type { TFunction } from '../button-types';

/** Data-layer + i18n dependencies threaded into every media extension (image,
 *  audio, ...). Generalizes Slice 1's ImageDeps: createAttachment now takes the
 *  kind so one insert pipeline serves all media types. */
export interface AttachmentDeps {
  getNoteId: () => Promise<string>;
  createAttachment: (noteId: string, file: File, kind: AttachmentKind) => Promise<Attachment>;
  getAttachment: (id: string) => Promise<Attachment | undefined>;
  cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>;
  updateAttachment: (id: string, changes: { blob?: Blob; preview?: string }) => Promise<void>;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}
