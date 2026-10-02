import type { Editor } from '@tiptap/react';
import { EditorColorPickerButton } from '@/components/editor/extensions/EditorColorPickerButton';

interface TextColorButtonProps {
  editor: Editor;
  tooltip?: string;
}

export function TextColorButton(props: TextColorButtonProps) {
  return <EditorColorPickerButton {...props} variant="text" />;
}

export default TextColorButton;
