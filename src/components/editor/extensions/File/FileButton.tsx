import type { Editor } from '@tiptap/core';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';

export interface FileButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file picker with no `accept`
 *  restriction (a file attachment accepts any type; an unrestricted picker also
 *  sidesteps the Chrome-on-Linux greying-out that specific MIME types trigger),
 *  then runs the shared insert pipeline. The 50 MB size cap is enforced in
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
