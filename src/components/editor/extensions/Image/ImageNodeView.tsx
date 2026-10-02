import type { ReactNodeViewProps } from '@tiptap/react';
import { type AttachmentNodeCopy, AttachmentNodeView } from '../attachments/AttachmentNodeView';

const COPY: AttachmentNodeCopy = {
  delete: 'editor.image.delete',
  unavailable: 'editor.image.unavailable',
  fallbackName: 'editor.image.fallbackAlt',
};

export function ImageNodeView(props: ReactNodeViewProps) {
  return (
    <AttachmentNodeView
      props={props}
      copy={COPY}
      className="not-prose relative my-2 inline-block max-w-full"
    >
      {(state, deps) => (
        <img
          src={state.url}
          alt={state.name ?? deps.t(COPY.fallbackName)}
          width={state.attachment.width}
          height={state.attachment.height}
          className="block h-auto max-w-full rounded-md"
        />
      )}
    </AttachmentNodeView>
  );
}

export default ImageNodeView;
