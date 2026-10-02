import type { Editor } from '@tiptap/core';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import type { AttachmentDeps } from '../attachments/deps.ts';
import { insertAttachmentFiles, withDerivedAttachmentData } from '../attachments/insert.ts';

/** Stores the card Preview and the pixel size atomically with the image. */
export function insertImageAttachmentFiles(
  editor: Editor,
  files: FileList | File[],
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const imageDeps = withDerivedAttachmentData(deps, 'image', generateImageThumbnail);

  return insertAttachmentFiles(editor, files, 'image', imageDeps, insertNode);
}
