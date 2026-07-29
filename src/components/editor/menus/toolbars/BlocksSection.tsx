import type { Editor } from '@tiptap/react';
import type React from 'react';
import ExtensionButtonBar from '@/components/editor/menus/ExtensionButtonBar.tsx';

/**
 * Block-level buttons: blockquote, math, and image/audio insert. Each is an
 * extension-owned Pattern A button (ADR 0004). `Mathematics` is the name of the
 * bundled math extension (inline + block); `imageAttachment` is the custom image
 * node (M3 Slice 1); `audioAttachment` is the custom audio node (M3 Slice 2);
 * `videoAttachment` is the custom video node (M3 Slice 3); `fileAttachment` is
 * the generic file node (M3 Slice 4); `excalidrawAttachment` is the custom
 * drawing node (M3 Slice 5).
 * Headings live in their own section at the start of the toolbar.
 */
export const BLOCK_EXTENSION_NAMES = [
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'textAlign',
  'Mathematics',
  'imageAttachment',
  'audioAttachment',
  'videoAttachment',
  'fileAttachment',
  'excalidrawAttachment',
];

interface BlocksSectionProps {
  editor: Editor;
  className?: string;
}

export const BlocksSection: React.FC<BlocksSectionProps> = ({ editor, className }) => {
  return <ExtensionButtonBar editor={editor} names={BLOCK_EXTENSION_NAMES} className={className} />;
};

export default BlocksSection;
