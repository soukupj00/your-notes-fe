import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, sceneToFile, sceneToSvgString } from './scene';

/** Commit-on-Save orchestration shared by the Excalidraw modal. On a *new*
 *  drawing (no attachmentId) it persists the note draft, creates the attachment
 *  row, stores the SVG snapshot, and inserts the node via `insertNode`. On an
 *  *edit* it writes the scene blob + refreshed snapshot back to the same row (the
 *  node's attachmentId never changes, so the body stays clean and the live-query
 *  preview refreshes on its own). A failed snapshot render never blocks the save:
 *  the blob is still written and `preview` is simply omitted (so an existing
 *  preview is not clobbered with undefined). */
export async function commitExcalidrawScene(
  deps: Pick<AttachmentDeps, 'getNoteId' | 'createAttachment' | 'updateAttachment'>,
  attachmentId: string | null,
  scene: ExcalidrawScene,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const preview = await sceneToSvgString(scene).catch((err) => {
    console.error('commitExcalidrawScene: SVG snapshot failed', err);
    return undefined;
  });

  if (attachmentId == null) {
    const noteId = await deps.getNoteId();
    const att = await deps.createAttachment(noteId, sceneToFile(scene), 'excalidraw');
    if (preview) await deps.updateAttachment(att.id, { preview });
    insertNode(att.id);
    return;
  }

  const changes: { blob?: Blob; preview?: string } = { blob: sceneToFile(scene) };
  if (preview) changes.preview = preview;
  await deps.updateAttachment(attachmentId, changes);
}
