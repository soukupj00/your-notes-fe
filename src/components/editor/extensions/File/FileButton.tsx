import type { Editor } from '@tiptap/core';
import { useRef } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ActionButton icon="Paperclip" tooltip={tooltip} action={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          // Resolve deps at click time so the button reads the freshest getNoteId.
          if (e.target.files)
            void insertAttachmentFiles(editor, e.target.files, 'file', getDeps(), (id) =>
              editor.chain().focus().insertFileAttachment({ attachmentId: id }).run()
            );
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
