import type { Editor } from '@tiptap/core';
import { ALLOWED_IMAGE_MIME } from '@/lib/attachments.ts';
import { AttachmentFilePickerButton } from '../attachments/AttachmentFilePickerButton';
import type { AttachmentDeps } from '../attachments/deps';
import { insertImageAttachmentFiles } from './insert';

export interface ImageButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file image picker (mobile camera
 *  comes free via accept="image/*"), then runs the shared insert pipeline. */
export function ImageButton({ editor, getDeps, tooltip }: ImageButtonProps) {
  return (
    <AttachmentFilePickerButton
      icon="ImagePlus"
      tooltip={tooltip}
      accept={ALLOWED_IMAGE_MIME.join(',')}
      onFiles={(files) => {
        // Resolve deps after selection so the button reads the freshest getNoteId.
        void insertImageAttachmentFiles(editor, files, getDeps(), (id) =>
          editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
        );
      }}
    />
  );
}
