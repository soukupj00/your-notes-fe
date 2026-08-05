import type { Editor } from '@tiptap/react';
import type React from 'react';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { MenuRowLabelProvider } from '@/components/ui/ActionButton.tsx';
import { CUSTOMIZE_ITEM_ID, resolveItemButton } from './registry';
import { ToolbarCustomizeButton } from './ToolbarCustomizeButton';
import type { ToolbarItem } from './types';

interface ToolbarLeafProps {
  item: ToolbarItem;
  editor: Editor;
  t: TFunction;
  /**
   * Render as a full-width labelled row inside a collapsed family's menu rather
   * than as an icon on the bar.
   *
   * The behaviour is identical either way - it is the same button, with the same
   * `isActive` and the same action (ADR 0011, decision 7). Only the presentation
   * differs, and it has to: a menu row has space for the name, which is what a
   * floating tooltip was doing badly, and on touch - where a tooltip never
   * usefully appears - it is the only labelling the control gets.
   */
  inMenu?: boolean;
}

/**
 * One leaf: the button view its extension contributes, or nothing at all.
 *
 * Rendering nothing for an unresolvable id is deliberate - an extension that is
 * not mounted should cost its own button, not the whole bar.
 */
export const ToolbarLeaf: React.FC<ToolbarLeafProps> = ({ item, editor, t, inMenu }) => {
  // The one Item with no extension behind it: it changes the bar, not the note,
  // so the bar owns it rather than resolving it through TipTap.
  if (item.id === CUSTOMIZE_ITEM_ID) return <ToolbarCustomizeButton />;

  const view = resolveItemButton(item, { editor, t });
  if (!view) return null;
  const { component: Component, componentProps } = view;

  if (!inMenu) return <Component {...componentProps} />;

  // Name the row here and let whichever `ActionButton` ends up being it read the
  // name off the context. Half the leaves are custom components - `link`, the
  // five attachment pickers, the two colour triggers - that wrap an
  // `ActionButton` rather than being one, and they used to render as bare,
  // nameless icons in a menu sized for labelled rows. The registry already knows
  // every leaf's name; nothing between here and the button needs to carry it.
  //
  // No shortcut on the row: it is drawn on touch as readily as on a desktop, and
  // a collapsed family is overwhelmingly a phone. The tooltip is where a
  // shortcut belongs, and `ActionButton` shows it only to a fine pointer.
  return (
    <MenuRowLabelProvider value={t(item.labelKey)}>
      <Component {...componentProps} />
    </MenuRowLabelProvider>
  );
};

export default ToolbarLeaf;
