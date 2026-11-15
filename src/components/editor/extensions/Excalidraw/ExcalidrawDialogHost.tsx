import type { Editor } from '@tiptap/core';
import { lazy, type RefObject, Suspense, useCallback, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { AttachmentError } from '@/lib/attachments.ts';
import { insertAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps, ExcalidrawOpenArgs } from '../attachments/deps';
import { commitExcalidrawScene } from './commit';
import { type ExcalidrawScene, emptyScene, parseScene } from './scene';

const ExcalidrawDialog = lazy(() => import('./ExcalidrawDialog'));

// Excalidraw resolves its bundled fonts/assets relative to this origin - pin it
// to the app root so it works the same under the PWA's service-worker scope.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/';
}

/** `attachmentId: null` is a new drawing that Save creates. `onDelete` is the same node
 *  removal as the preview's corner X. */
export interface OpenDrawing {
  open: boolean;
  attachmentId: string | null;
  initialScene: ExcalidrawScene | null;
  onDelete?: () => void;
  onReplace?: (attachmentId: string) => void;
  // Bumped on every open so the dialog remounts (fresh dirty/empty state) even
  // when the same drawing - or another new one - is opened twice in a row.
  key: number;
}

/** The state half lives apart from the host, because `openExcalidraw` is one of the deps the
 *  host reads its own through. */
export function useOpenDrawing(getAttachment: AttachmentDeps['getAttachment']) {
  const [drawing, setDrawing] = useState<OpenDrawing>({
    open: false,
    attachmentId: null,
    initialScene: null,
    key: 0,
  });
  const openSeqRef = useRef(0);

  const openExcalidraw = useCallback(
    ({ attachmentId, onDelete, onReplace }: ExcalidrawOpenArgs) => {
      const key = ++openSeqRef.current;
      if (!attachmentId) {
        setDrawing({ open: true, attachmentId: null, initialScene: emptyScene(), onDelete, key });
        return;
      }
      // One-shot read: the modal edits its own copy and commits on Save.
      void getAttachment(attachmentId).then(async (att) => {
        const scene = att?.blob ? parseScene(await att.blob.text()) : null;
        setDrawing({
          open: true,
          attachmentId,
          initialScene: scene ?? emptyScene(),
          onDelete,
          onReplace,
          key,
        });
      });
    },
    [getAttachment]
  );

  const closeExcalidraw = useCallback(() => setDrawing((s) => ({ ...s, open: false })), []);

  return { drawing, openExcalidraw, closeExcalidraw };
}

interface ExcalidrawDialogHostProps {
  drawing: OpenDrawing;
  onClose: () => void;
  editorRef: RefObject<Editor | null>;
  getDeps: () => AttachmentDeps;
}

/** The editor's one drawing dialog, lazy-loaded on the first open; the live canvas never lives
 *  inline in the doc. Commit-on-Save: every Save mints a new row; a new drawing inserts its
 *  node, an edit repoints the existing one. */
export function ExcalidrawDialogHost({
  drawing,
  onClose,
  editorRef,
  getDeps,
}: ExcalidrawDialogHostProps) {
  const { attachmentId, onReplace } = drawing;
  const handleSave = useCallback(
    async (scene: ExcalidrawScene) => {
      try {
        await commitExcalidrawScene(getDeps(), attachmentId, scene, (id) => {
          if (attachmentId) {
            onReplace?.(id);
            return;
          }
          const editor = editorRef.current;
          if (editor) insertAttachmentNode(editor, 'excalidraw', id);
        });
      } catch (err) {
        console.error('Editor: excalidraw save failed', err);
        getDeps().onError(
          err instanceof AttachmentError ? err.code : 'insert-failed',
          'excalidraw'
        );
      } finally {
        onClose();
      }
    },
    [attachmentId, editorRef, getDeps, onClose, onReplace]
  );

  if (!drawing.open) return null;
  const { t } = getDeps();

  return (
    <Suspense
      fallback={
        <div
          className="fixed inset-0 z-50 flex items-center justify-center gap-2 bg-background/80"
          role="status"
          aria-label={t('editor.excalidraw.title')}
        >
          <Spinner className="size-6" />
        </div>
      }
    >
      <ExcalidrawDialog
        key={drawing.key}
        open
        mode={attachmentId ? 'edit' : 'new'}
        initialScene={drawing.initialScene}
        onSave={handleSave}
        onDelete={drawing.onDelete}
        onClose={onClose}
        t={t}
      />
    </Suspense>
  );
}
