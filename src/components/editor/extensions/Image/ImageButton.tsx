import type { Editor } from '@tiptap/core';
import type { ImageDeps } from './Image';

export interface ImageButtonProps {
  editor: Editor;
  deps: ImageDeps;
  tooltip: string;
}

// Placeholder - real hidden-file-input button lands in Task 7.
export function ImageButton(_props: ImageButtonProps) {
  return null;
}
