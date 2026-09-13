import type { Editor } from '@tiptap/core';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertImageAttachmentFiles } from './insert';

export interface ImageButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file image picker. `accept="image/*"`
 *  rather than the MIME whitelist, for the same two reasons as VideoButton:
 *  Android only offers the camera for the wildcard, and Chrome on Linux greys
 *  out valid files when specific types are listed. The whitelist is still
 *  enforced in `validateAttachmentFile` after selection. */
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
