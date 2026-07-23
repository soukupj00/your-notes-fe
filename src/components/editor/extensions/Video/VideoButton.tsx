import type { Editor } from '@tiptap/core';
import { useRef } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';

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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ActionButton icon="FileVideo" tooltip={tooltip} action={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          // Resolve deps at click time so the button reads the freshest getNoteId.
          if (e.target.files)
            void insertAttachmentFiles(editor, e.target.files, 'video', getDeps(), (id) =>
              editor.chain().focus().insertVideoAttachment({ attachmentId: id }).run()
            );
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
