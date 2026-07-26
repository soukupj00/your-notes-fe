import type { Editor } from '@tiptap/core';
import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import type { AttachmentDeps } from '../attachments/deps.ts';
import { insertAttachmentFiles } from '../attachments/insert.ts';

/** Image-specific insertion step: generate the card Preview before atomically
 * storing it with the authoritative image, then use the shared media pipeline. */
export function insertImageAttachmentFiles(
  editor: Editor,
  files: FileList | File[],
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const imageDeps: AttachmentDeps = {
    ...deps,
    createAttachment: async (noteId, file, kind) => {
      const validationError = validateAttachmentFile(file, 'image');
      if (validationError) throw new AttachmentError(validationError);
      const thumbnail = await generateImageThumbnail(file);
      return thumbnail
        ? deps.createAttachment(noteId, file, kind, { thumbnail })
        : deps.createAttachment(noteId, file, kind);
    },
  };

  return insertAttachmentFiles(editor, files, 'image', imageDeps, insertNode);
}
