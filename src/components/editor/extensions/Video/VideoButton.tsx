import type { Editor } from '@tiptap/core';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertVideoAttachmentFiles } from './insert.ts';

export interface VideoButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file video picker, then runs the
 *  shared insert pipeline. `accept="video/*"` (not the explicit MIME whitelist):
 *  Chrome on Linux greys out valid files when a specific type like `video/mp4`
 *  is listed, and mobile camera capture comes free with the wildcard. The
 *  whitelist is still enforced in `validateAttachmentFile` after selection. */
export function VideoButton({ editor, getDeps, tooltip }: VideoButtonProps) {
  return (
    <AttachmentFilePickerButton
      icon="FileVideo"
      tooltip={tooltip}
      accept="video/*"
      onFiles={(files) => {
        // Resolve deps after selection so the button reads the freshest getNoteId.
        void insertVideoAttachmentFiles(editor, files, getDeps(), (id) =>
          editor.chain().focus().insertVideoAttachment({ attachmentId: id }).run()
        );
      }}
    />
  );
}
