import type { Editor } from '@tiptap/core';
import { useRef } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { ALLOWED_IMAGE_MIME } from '@/lib/attachments.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';

export interface ImageButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file image picker (mobile camera
 *  comes free via accept="image/*"), then runs the shared insert pipeline. */
export function ImageButton({ editor, getDeps, tooltip }: ImageButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ActionButton icon="ImagePlus" tooltip={tooltip} action={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          // Resolve deps at click time so the button reads the freshest getNoteId.
          if (e.target.files)
            void insertAttachmentFiles(editor, e.target.files, 'image', getDeps(), (id) =>
              editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
            );
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
