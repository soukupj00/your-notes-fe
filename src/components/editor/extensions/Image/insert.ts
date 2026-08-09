import type { Editor } from '@tiptap/core';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import type { AttachmentDeps } from '../attachments/deps.ts';
import { insertAttachmentFiles, withDerivedAttachmentData } from '../attachments/insert.ts';

/** Image-specific insertion step: generate the card Preview before atomically
 *  storing it with the authoritative image, then use the shared media pipeline. */
export function insertImageAttachmentFiles(
  editor: Editor,
  files: FileList | File[],
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const imageDeps = withDerivedAttachmentData(deps, 'image', async (file) => ({
    thumbnail: await generateImageThumbnail(file),
  }));

  return insertAttachmentFiles(editor, files, 'image', imageDeps, insertNode);
}
