import type { Editor } from '@tiptap/react';
import { EditorTextStyleSelect } from '@/components/editor/extensions/EditorTextStyleSelect';

interface FontSizeButtonProps {
  editor: Editor;
  tooltip?: string;
}

/** Pattern A adapter for the shared editor text-style select. */
export function FontSizeButton(props: FontSizeButtonProps) {
  return <EditorTextStyleSelect {...props} variant="fontSize" />;
}

export default FontSizeButton;
