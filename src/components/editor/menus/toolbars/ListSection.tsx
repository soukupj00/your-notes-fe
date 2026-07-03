import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/** List toggles rendered in order. Each is an extension-owned Pattern A button (ADR 0004). */
const LIST_EXTENSION_NAMES = ['bulletList', 'orderedList', 'taskList'];

interface ListSectionProps {
  editor: Editor;
  className?: string;
}

/**
 * The list section of the editor toolbar. Composes the bullet / ordered / task
 * list buttons from their extensions. Because these buttons run the underlying
 * `toggle*List` commands directly (no `can()` gating), clicking one while another
 * list type is active switches between them, and clicking the active one turns it off.
 */
export const ListSection: React.FC<ListSectionProps> = ({ editor, className }) => {
  return <ExtensionButtonBar editor={editor} names={LIST_EXTENSION_NAMES} className={className} />;
};

export default ListSection;
