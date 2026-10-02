import type { Editor } from '@tiptap/core';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { AttachmentDeps } from '../attachments/deps.ts';
import { insertAttachmentFiles, withDerivedAttachmentData } from '../attachments/insert.ts';

/** The feed never decodes a video, so the card has a preview only if a poster was captured
 *  here, before storing. Best-effort: an undecodable clip is still stored, and the card
 *  falls back to a neutral plane. */
export function insertVideoAttachmentFiles(
  editor: Editor,
  files: FileList | File[],
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const videoDeps = withDerivedAttachmentData(deps, 'video', async (file) => {
    const { poster, ...metadata } = await generateVideoPoster(file);
    return { thumbnail: poster, ...metadata };
  });

  return insertAttachmentFiles(editor, files, 'video', videoDeps, insertNode);
}
