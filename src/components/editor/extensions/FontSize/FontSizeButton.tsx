import type { Editor } from '@tiptap/react';
import { EditorTextStyleSelect } from '@/components/editor/extensions/EditorTextStyleSelect';
import type { TFunction } from '../button-types';

interface FontSizeButtonProps {
  editor: Editor;
  tooltip?: string;
  t: TFunction;
}

/** Pattern A adapter for the shared editor text-style select. */
export function FontSizeButton(props: FontSizeButtonProps) {
  return <EditorTextStyleSelect {...props} variant="fontSize" />;
}

export default FontSizeButton;
