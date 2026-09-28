import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, sceneToFile, sceneToSvgString } from './scene';

/** Commit-on-Save orchestration shared by the Excalidraw modal. Every Save mints
 *  a *new* attachment row (persisting the note draft first) and hands its id to
 *  `place`: a new drawing inserts the node, an edit repoints the existing node at
 *  it. Bytes are therefore write-once by id (ADR 0017), which is what lets sync
 *  treat a blob upload as idempotent; the old row is left to the note-scoped
 *  orphan sweep once the Body no longer references it. A failed snapshot render
 *  never blocks the save: the scene is still written, and an edit carries the
 *  previous preview forward rather than showing none. */
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
