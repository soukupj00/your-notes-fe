import type { Editor } from '@tiptap/react';
import { EditorTextStyleSelect } from '@/components/editor/extensions/EditorTextStyleSelect';

interface FontFamilyButtonProps {
  editor: Editor;
  tooltip?: string;
}

/** Pattern A adapter for the shared editor text-style select. */
export function FontFamilyButton(props: FontFamilyButtonProps) {
  return <EditorTextStyleSelect {...props} variant="fontFamily" />;
}

export default FontFamilyButton;
