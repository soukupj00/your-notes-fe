import type { Editor } from '@tiptap/react';
import { EditorTextStyleSelect } from '@/components/editor/extensions/EditorTextStyleSelect';
import type { TFunction } from '../button-types';

interface FontFamilyButtonProps {
  editor: Editor;
  tooltip?: string;
  t: TFunction;
}

/** Pattern A adapter for the shared editor text-style select. */
export function FontFamilyButton(props: FontFamilyButtonProps) {
  return <EditorTextStyleSelect {...props} variant="fontFamily" />;
}

export default FontFamilyButton;
