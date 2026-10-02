import type { Editor } from '@tiptap/core';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertImageAttachmentFiles } from './insert';

export interface ImageButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** `accept="image/*"`, not the MIME whitelist: Android offers the camera only for the
 *  wildcard, and Chrome on Linux greys out valid files when specific types are listed.
 *  The whitelist is still enforced by `validateAttachmentFile`. */
export function ImageButton({ editor, getDeps, tooltip }: ImageButtonProps) {
  return (
    <AttachmentFilePickerButton
      icon="ImagePlus"
      tooltip={tooltip}
      accept="image/*"
      onFiles={(files) => {
        // Resolve deps after selection so the button reads the freshest getNoteId.
        void insertImageAttachmentFiles(editor, files, getDeps(), (id) =>
          editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
        );
      }}
    />
  );
}
