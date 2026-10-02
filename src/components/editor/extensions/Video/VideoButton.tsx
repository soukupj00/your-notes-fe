import type { Editor } from '@tiptap/core';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertVideoAttachmentFiles } from './insert.ts';

export interface VideoButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** `accept="video/*"`, not the MIME whitelist: Chrome on Linux greys out valid files when a
 *  specific type is listed, and mobile camera capture comes with the wildcard. The whitelist
 *  is still enforced by `validateAttachmentFile`. */
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
