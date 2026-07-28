import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useLiveQuery } from 'dexie-react-hooks';
import DOMPurify from 'dompurify';
import { db } from '@/db/db.ts';
import { cn } from '@/lib/utils.ts';
import { AttachmentDeleteButton } from '../attachments/AttachmentDeleteButton';
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
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.excalidraw.delete')}
      t={deps.t}
      overlay
    />
  ) : null;

  const openEditor = () => {
    if (!attachmentId) return;
    deps.openExcalidraw({ attachmentId, onDelete: () => props.deleteNode() });
  };

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

  const loading = row === undefined;
  const surfaceClass = cn(
    'block max-w-full overflow-hidden rounded-md border [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full',
    loading && 'h-32 w-64 animate-pulse border-0 bg-muted'
  );
  // Self-generated SVG snapshot (see sceneToSvgString), still run through
  // DOMPurify to match the read-only NoteBody trust model.
  const previewMarkup = loading ? undefined : { __html: DOMPurify.sanitize(row.preview ?? '') };

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="relative inline-block max-w-full align-top">
        {/* Keep this button mounted while the live query resolves. Replacing the
            loading element between pointer-down and click loses the user's first
            click on fast note-open races. */}
        {editable ? (
          <button
            type="button"
            aria-label={deps.t('editor.excalidraw.edit')}
            onClick={openEditor}
            contentEditable={false}
            className={cn(surfaceClass, 'cursor-pointer text-left')}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify-sanitized SVG snapshot (see previewMarkup).
            dangerouslySetInnerHTML={previewMarkup}
          />
        ) : (
          <div
            className={surfaceClass}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify-sanitized SVG snapshot (see previewMarkup).
            dangerouslySetInnerHTML={previewMarkup}
          />
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default ExcalidrawNodeView;
