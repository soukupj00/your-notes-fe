import type { Live } from '@/data/live.ts';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import type { TFunction } from '../button-types';
import type { DerivedAttachmentData } from './insert';

export type ExcalidrawOpenArgs = {
  attachmentId?: string;
  onDelete?: () => void;
  onReplace?: (attachmentId: string) => void;
};

/** Data-layer + i18n dependencies threaded into every media extension (image,
 *  audio, ...). Generalizes Slice 1's ImageDeps: createAttachment now takes the
 *  kind so one insert pipeline serves all media types. */
export interface AttachmentDeps {
  getNoteId: () => Promise<string>;
  createAttachment: (
    noteId: string,
    file: File,
    kind: AttachmentKind,
    options?: DerivedAttachmentData
  ) => Promise<Attachment>;
  getAttachment: (id: string) => Promise<Attachment | undefined>;
  /** The row, live, for node views: a download or a pull re-renders them. */
  watchAttachment: (id: string) => Live<Attachment | undefined>;
  /**
   * Fetches a synced row's full bytes from the server (M5 slice 5). Answers
   * false when the server does not have them yet; rejects when it cannot be reached
   * or this Device is not signed in.
   */
  downloadAttachment: (id: string) => Promise<boolean>;
  cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>;
  /** Derived data only; bytes are write-once by id, so there is no `blob` here. */
  updateAttachment: (id: string, changes: { preview?: string }) => Promise<void>;
  /** Open the shared Excalidraw editing modal. No attachmentId = a new drawing
   *  (commit-on-Save creates the row); with one = edit that drawing. `onDelete`
   *  (edit only) removes the node so the modal's Delete and the preview's corner-X
   *  funnel through the same deleteNode() path. `onReplace` (edit only) repoints
   *  the node at the row a Save minted, since a Save never rewrites bytes. */
  openExcalidraw: (args: ExcalidrawOpenArgs) => void;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}
