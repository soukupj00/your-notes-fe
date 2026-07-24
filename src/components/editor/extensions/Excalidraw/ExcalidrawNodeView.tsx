import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db.ts';
import { cn } from '@/lib/utils.ts';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';

/** Editor render path for excalidrawAttachment - a passive preview, never the
 *  live canvas (that lives in the shared modal, opened on tap). The whole surface
 *  is tap-to-edit; a corner-X always offers delete. The row is live-queried so a
 *  modal Save refreshes the inline preview in place with zero body churn (the
 *  node's attachmentId never changes). The home feed does not mount this at all -
 *  it injects the stored SVG in NoteBody. */
export function ExcalidrawNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const editable = props.editor?.isEditable ?? false;

  // undefined = loading, null = missing, object = ready.
  const row = useLiveQuery(
    async () => (attachmentId ? ((await db.attachments.get(attachmentId)) ?? null) : null),
    [attachmentId]
  );

  // Delete is a sibling of the preview surface, positioned inside the same
  // shrink-wrapped frame. A delete tap never reaches the surface's open handler.
  const deleteButton = editable ? (
    <span className="absolute top-2 right-2 z-10 rounded-full bg-background/80">
      <ConfirmDeleteButton
        onConfirm={() => props.deleteNode()}
        label={deps.t('editor.excalidraw.delete')}
        t={deps.t}
      />
    </span>
  ) : null;

  if (row === undefined) {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      </NodeViewWrapper>
    );
  }

  if (row === null) {
    return (
      <NodeViewWrapper as="div" className="relative my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.excalidraw.unavailable')}</span>
        </div>
        {deleteButton}
      </NodeViewWrapper>
    );
  }

  const surfaceClass =
    'block max-w-full overflow-hidden rounded-md border [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full';
  const openEditor = () => {
    if (!attachmentId) return;
    deps.openExcalidraw({ attachmentId, onDelete: () => props.deleteNode() });
  };

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="relative inline-block max-w-full align-top">
        {/* Passive preview surface (self-generated SVG snapshot). Editable: a real
            button (tap/keyboard opens the shared modal); read-only: a plain box. */}
        {editable ? (
          <button
            type="button"
            aria-label={deps.t('editor.excalidraw.edit')}
            onClick={openEditor}
            contentEditable={false}
            className={cn(surfaceClass, 'cursor-pointer text-left')}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: self-generated SVG snapshot (see sceneToSvgString).
            dangerouslySetInnerHTML={{ __html: row.preview ?? '' }}
          />
        ) : (
          <div
            className={surfaceClass}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: self-generated SVG snapshot (see sceneToSvgString).
            dangerouslySetInnerHTML={{ __html: row.preview ?? '' }}
          />
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default ExcalidrawNodeView;
