import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/**
 * Block-level buttons: blockquote, math, and image/audio insert. Each is an
 * extension-owned Pattern A button (ADR 0004). `Mathematics` is the name of the
 * bundled math extension (inline + block); `imageAttachment` is the custom image
 * node (M3 Slice 1); `audioAttachment` is the custom audio node (M3 Slice 2);
 * `videoAttachment` is the custom video node (M3 Slice 3).
 * Headings live in their own section at the start of the toolbar.
 */
const BLOCK_EXTENSION_NAMES = [
  'blockquote',
  'Mathematics',
  'imageAttachment',
  'audioAttachment',
  'videoAttachment',
];

interface BlocksSectionProps {
  editor: Editor;
  className?: string;
}

export const BlocksSection: React.FC<BlocksSectionProps> = ({ editor, className }) => {
  return <ExtensionButtonBar editor={editor} names={BLOCK_EXTENSION_NAMES} className={className} />;
};

export default BlocksSection;
