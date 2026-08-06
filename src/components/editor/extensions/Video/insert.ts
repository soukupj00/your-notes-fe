import type { Editor } from '@tiptap/core';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { AttachmentDeps } from '../attachments/deps.ts';
import { insertAttachmentFiles, withDerivedAttachmentData } from '../attachments/insert.ts';

/**
 * Video-specific insertion step, mirroring `insertImageAttachmentFiles`: capture
 * a poster frame and the clip length before storing, then hand off to the shared
 * media pipeline.
 *
 * A video's bytes are a container the feed must never decode, so the card has no
 * preview to show unless one was captured up front. Poster capture is
 * best-effort - a clip the browser cannot decode is still stored, and the card
 * falls back to a neutral plane.
 */
export function insertVideoAttachmentFiles(
  editor: Editor,
  files: FileList | File[],
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const videoDeps = withDerivedAttachmentData(deps, 'video', async (file) => {
    const { poster, duration } = await generateVideoPoster(file);
    return { thumbnail: poster, duration };
  });

  return insertAttachmentFiles(editor, files, 'video', videoDeps, insertNode);
}
