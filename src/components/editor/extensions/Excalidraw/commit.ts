import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, sceneToFile, sceneToSvgString } from './scene';

/** Every Save mints a new row and hands its id to `place`, so bytes stay write-once by id
 *  (ADR 0017) and the orphan sweep removes the old row. A failed snapshot never blocks the
 *  save: an edit carries the previous preview forward. */
export async function commitExcalidrawScene(
  deps: Pick<
    AttachmentDeps,
    'getNoteId' | 'createAttachment' | 'getAttachment' | 'updateAttachment'
  >,
  previousId: string | null,
  scene: ExcalidrawScene,
  place: (attachmentId: string) => void
): Promise<void> {
  const rendered = await sceneToSvgString(scene).catch((err) => {
    console.error('commitExcalidrawScene: SVG snapshot failed', err);
    return undefined;
  });
  const preview =
    rendered ?? (previousId ? (await deps.getAttachment(previousId))?.preview : undefined);

  const noteId = await deps.getNoteId();
  const att = await deps.createAttachment(noteId, sceneToFile(scene), 'excalidraw');
  if (preview) await deps.updateAttachment(att.id, { preview });
  place(att.id);
}
