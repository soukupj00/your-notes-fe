import { useEffect, useState } from 'react';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, parseScene } from './scene';

export type ExcalidrawSceneState =
  | { status: 'loading' }
  | { status: 'ready'; scene: ExcalidrawScene; attachment: Attachment }
  | { status: 'missing' };

/**
 * JSON analogue of useAttachmentObjectUrl: resolves attachmentId -> Attachment ->
 * parsed scene. No object URL to revoke - a plain async read guarded by `active`.
 * Pass a STABLE getAttachment so the effect does not re-run every render.
 */
export function useExcalidrawScene(
  attachmentId: string | null,
  getAttachment: AttachmentDeps['getAttachment']
): ExcalidrawSceneState {
  const [state, setState] = useState<ExcalidrawSceneState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    if (!attachmentId) {
      setState({ status: 'missing' });
      return;
    }
    getAttachment(attachmentId).then(async (att) => {
      if (!active) return;
      if (!att) {
        setState({ status: 'missing' });
        return;
      }
      const scene = parseScene(await att.blob.text());
      setState(scene ? { status: 'ready', scene, attachment: att } : { status: 'missing' });
    });
    return () => {
      active = false;
    };
  }, [attachmentId, getAttachment]);
  return state;
}
