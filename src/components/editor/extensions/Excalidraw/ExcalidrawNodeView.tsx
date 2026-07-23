import { Excalidraw } from '@excalidraw/excalidraw';
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, sceneToFile, sceneToSvgString } from './scene';
import { useExcalidrawScene } from './useExcalidrawScene';

const WRITE_DEBOUNCE_MS = 800;

/** Editor render path for excalidrawAttachment. Editable: the live canvas with a
 *  debounced write-back to the same attachment row (blob + regenerated SVG
 *  snapshot). Read-only: the stored preview SVG. Missing/malformed: a dashed box.
 *  The home feed never mounts this - it injects the stored SVG in NoteBody. */
export function ExcalidrawNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useExcalidrawScene(attachmentId, deps.getAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ExcalidrawScene | null>(null);

  const flush = useCallback(async () => {
    const scene = pendingRef.current;
    if (!scene || !attachmentId) return;
    pendingRef.current = null;
    try {
      const blob = sceneToFile(scene);
      let preview: string | undefined;
      try {
        preview = await sceneToSvgString(scene);
      } catch (err) {
        console.error('ExcalidrawNodeView: SVG snapshot failed', err);
      }
      await deps.updateAttachment(attachmentId, { blob, preview });
    } catch (err) {
      console.error('ExcalidrawNodeView: scene write-back failed', err);
    }
  }, [attachmentId, deps]);

  // Flush any pending write on unmount so the last edit is not lost.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };
  }, [flush]);

  const onChange = useCallback(
    (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>
    ) => {
      pendingRef.current = { elements, appState, files };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS);
    },
    [flush]
  );

  const deleteButton = canDelete ? (
    <ConfirmDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.excalidraw.delete')}
      t={deps.t}
    />
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.excalidraw.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  if (state.status === 'loading') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      </NodeViewWrapper>
    );
  }

  // Read-only viewer: the stored SVG snapshot (self-generated, trusted markup).
  if (!canDelete) {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div
          className="max-w-full [&>svg]:max-w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: self-generated SVG snapshot
          dangerouslySetInnerHTML={{ __html: state.attachment.preview ?? '' }}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-start gap-3">
        <div className="h-[420px] flex-1 overflow-hidden rounded-md border" contentEditable={false}>
          <Excalidraw initialData={state.scene as never} onChange={onChange as never} />
        </div>
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default ExcalidrawNodeView;
