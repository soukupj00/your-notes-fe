import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type { ImageDeps } from './Image';

type State =
  | { status: 'loading' }
  | { status: 'ready'; url: string; name?: string }
  | { status: 'missing' };

/**
 * Editor render path for imageAttachment. Resolves attachmentId → Blob → object
 * URL, revokes on unmount (ADR 0007 lifecycle). Shows a placeholder while
 * loading and a broken state if the row is gone (e.g. GC'd elsewhere).
 */
export function ImageNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  // Read deps through the stable getter so we always see live deps (the node is
  // built once by useEditor); calling per render keeps `getAttachment` current.
  const deps = (props.extension.options.getDeps as () => ImageDeps)();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    if (!attachmentId) {
      setState({ status: 'missing' });
      return;
    }
    deps.getAttachment(attachmentId).then((att) => {
      if (!active) return;
      if (!att) {
        setState({ status: 'missing' });
        return;
      }
      url = URL.createObjectURL(att.blob);
      setState({ status: 'ready', url, name: att.name });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId, deps]);

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      {state.status === 'ready' && (
        <img src={state.url} alt={state.name ?? 'Image'} className="h-auto max-w-full rounded-md" />
      )}
      {state.status === 'loading' && (
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      {state.status === 'missing' && (
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
          Image unavailable
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default ImageNodeView;
