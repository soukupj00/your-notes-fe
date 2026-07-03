import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/** Text-formatting buttons in order. Each is an extension-owned Pattern A button (ADR 0004). */
const FORMAT_EXTENSION_NAMES = ['bold', 'italic', 'underline', 'strike', 'clear'];

interface FormatSectionProps {
  editor: Editor;
  className?: string;
}

/**
 * The text-formatting section of the editor toolbar. Composes the bold / italic /
 * underline / strike / clear buttons from their extensions via {@link ExtensionButtonBar}.
 */
export const FormatSection: React.FC<FormatSectionProps> = ({ editor, className }) => {
  return (
    <ExtensionButtonBar editor={editor} names={FORMAT_EXTENSION_NAMES} className={className} />
  );
};

export default FormatSection;
