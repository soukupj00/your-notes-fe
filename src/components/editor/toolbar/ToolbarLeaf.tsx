import type { Editor } from '@tiptap/react';
import type React from 'react';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { resolveItemButton } from './registry';
import type { ToolbarItem } from './types';

/**
 * One leaf: the button view its extension contributes, or nothing at all.
 *
 * Rendering nothing for an unresolvable id is deliberate - an extension that is
 * not mounted should cost its own button, not the whole bar.
 */
export const ToolbarLeaf: React.FC<{ item: ToolbarItem; editor: Editor; t: TFunction }> = ({
  item,
  editor,
  t,
}) => {
  const view = resolveItemButton(item, { editor, t });
  if (!view) return null;
  const { component: Component, componentProps } = view;
  return <Component {...componentProps} />;
};

export default ToolbarLeaf;
