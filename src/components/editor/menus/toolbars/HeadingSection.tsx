import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/**
 * Heading level buttons (H1-H3), placed at the start of the toolbar. The Heading
 * extension contributes a button array (one per level), so this section renders
 * three buttons. (Mobile-first note: H2/H3 will later be hidden on small screens,
 * leaving only H1 - hence headings live in their own section.)
 */
const HEADING_EXTENSION_NAMES = ['heading'];

interface HeadingSectionProps {
  editor: Editor;
  className?: string;
}

export const HeadingSection: React.FC<HeadingSectionProps> = ({ editor, className }) => {
  return (
    <ExtensionButtonBar editor={editor} names={HEADING_EXTENSION_NAMES} className={className} />
  );
};

export default HeadingSection;
