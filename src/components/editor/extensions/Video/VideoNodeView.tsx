import type { ReactNodeViewProps } from '@tiptap/react';
import { type AttachmentNodeCopy, AttachmentNodeView } from '../attachments/AttachmentNodeView';

const COPY: AttachmentNodeCopy = {
  kind: 'video',
  delete: 'editor.video.delete',
  unavailable: 'editor.video.unavailable',
  fallbackName: 'editor.video.label',
};

/** Native controls, unlike audio: they give scrubbing, fullscreen and volume for free. */
export function VideoNodeView(props: ReactNodeViewProps) {
  return (
    <AttachmentNodeView
      props={props}
      copy={COPY}
      className="not-prose relative my-2 inline-block max-w-full"
    >
      {(state) => (
        // biome-ignore lint/a11y/useMediaCaption: a user's own recording has no captions to offer
        <video
          src={state.url}
          width={state.attachment.width}
          height={state.attachment.height}
          controls
          playsInline
          preload="metadata"
          className="block h-auto max-w-full rounded-md"
        />
      )}
    </AttachmentNodeView>
  );
}
