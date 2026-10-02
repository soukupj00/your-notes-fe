import type { Editor } from '@tiptap/react';
import { EditorColorPickerButton } from '@/components/editor/extensions/EditorColorPickerButton';

interface HighlightButtonProps {
  editor: Editor;
  tooltip?: string;
  shortcutKeys?: string[];
}

export function HighlightButton(props: HighlightButtonProps) {
  return <EditorColorPickerButton {...props} variant="highlight" />;
}

export default HighlightButton;
