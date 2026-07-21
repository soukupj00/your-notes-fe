import type { Editor } from '@tiptap/core';
import { useRef } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { ALLOWED_IMAGE_MIME } from '@/lib/attachments.ts';
import type { ImageDeps } from './Image';
import { insertImageFiles } from './insert';

export interface ImageButtonProps {
  editor: Editor;
  deps: ImageDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file image picker (mobile camera
 *  comes free via accept="image/*"), then runs the shared insert pipeline. */
export function ImageButton({ editor, deps, tooltip }: ImageButtonProps) {
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
          if (e.target.files) void insertImageFiles(editor, e.target.files, deps);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
