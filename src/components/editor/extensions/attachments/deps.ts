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
  /** Open the shared Excalidraw editing modal. No attachmentId = a new drawing
   *  (commit-on-Save creates the row); with one = edit that drawing. `onDelete`
   *  (edit only) removes the node so the modal's Delete and the preview's corner-X
   *  funnel through the same deleteNode() path. */
  openExcalidraw: (args: { attachmentId?: string; onDelete?: () => void }) => void;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}
