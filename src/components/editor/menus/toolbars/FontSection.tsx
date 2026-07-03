import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/** Font family/size buttons in order. Each is an extension-owned Pattern A button (ADR 0004). */
const FONT_EXTENSION_NAMES = ['fontFamily', 'fontSize'];

interface FontSectionProps {
  editor: Editor;
  className?: string;
}

/**
 * The font section of the editor toolbar. Composes the font-family / font-size
 * dropdowns from their extensions via {@link ExtensionButtonBar}.
 */
export const FontSection: React.FC<FontSectionProps> = ({ editor, className }) => {
  return <ExtensionButtonBar editor={editor} names={FONT_EXTENSION_NAMES} className={className} />;
};

export default FontSection;
