import type { Editor } from '@tiptap/core';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';

export interface FileButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** No `accept`: a file attachment takes any type. The size cap is enforced by
 *  `validateAttachmentFile` after selection. */
export function FileButton({ editor, getDeps, tooltip }: FileButtonProps) {
  return (
    <AttachmentFilePickerButton
      icon="Paperclip"
      tooltip={tooltip}
      onFiles={(files) => {
        // Resolve deps after selection so the button reads the freshest getNoteId.
        void insertAttachmentFiles(editor, files, 'file', getDeps(), (id) =>
          editor.chain().focus().insertFileAttachment({ attachmentId: id }).run()
        );
      }}
    />
  );
}
