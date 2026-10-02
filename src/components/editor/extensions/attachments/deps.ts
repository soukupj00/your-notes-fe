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
  /** False when the server does not have the bytes yet; rejects when it cannot be reached
   *  or this Device is not signed in. */
  downloadAttachment: (id: string) => Promise<boolean>;
  cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>;
  /** Derived data only; bytes are write-once by id, so there is no `blob` here. */
  updateAttachment: (id: string, changes: { preview?: string }) => Promise<void>;
  /** No `attachmentId` starts a new drawing. `onDelete` gives the dialog and the preview one
   *  deleteNode() path; `onReplace` repoints the node at the row a Save minted, since a Save
   *  never rewrites bytes. */
  openExcalidraw: (args: ExcalidrawOpenArgs) => void;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}
