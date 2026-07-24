import type { Editor } from '@tiptap/core';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { AttachmentError } from '@/lib/attachments.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { emptyScene, sceneToFile } from './scene';

export interface ExcalidrawButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point. Unlike image/audio/video there is no file - clicking
 *  mints an empty scene attachment (kind 'excalidraw', a JSON blob) and inserts
 *  the node; the NodeView's canvas then edits it in place and writes back. */
export function ExcalidrawButton({ editor, getDeps, tooltip }: ExcalidrawButtonProps) {
  const insert = async () => {
    const deps = getDeps(); // resolve at click time for the freshest getNoteId
    try {
      const noteId = await deps.getNoteId();
      const att = await deps.createAttachment(noteId, sceneToFile(emptyScene()), 'excalidraw');
      editor.chain().focus().insertExcalidrawAttachment({ attachmentId: att.id }).run();
    } catch (err) {
      if (err instanceof AttachmentError) {
        deps.onError(err.code);
      } else {
        console.error('ExcalidrawButton: failed to create drawing', err);
        deps.onError('insert-failed');
      }
    }
  };

  return <ActionButton icon="PenTool" tooltip={tooltip} action={() => void insert()} />;
}
