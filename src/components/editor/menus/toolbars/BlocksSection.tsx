import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/**
 * Block-level buttons in order: heading levels 1-3 (Heading contributes a button
 * array), blockquote, and inline math. Each is an extension-owned Pattern A button
 * (ADR 0004). `inlineMath` is the name of the wrapped Mathematics extension.
 */
const BLOCK_EXTENSION_NAMES = ['heading', 'blockquote', 'inlineMath'];

interface BlocksSectionProps {
  editor: Editor;
  className?: string;
}

export const BlocksSection: React.FC<BlocksSectionProps> = ({ editor, className }) => {
  return <ExtensionButtonBar editor={editor} names={BLOCK_EXTENSION_NAMES} className={className} />;
};

export default BlocksSection;
