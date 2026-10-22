import type { Editor } from '@tiptap/react';
import type React from 'react';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { MenuRowLabelProvider } from '@/components/ui/ActionButton.tsx';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { comboParts } from '@/lib/key-combo.ts';
import { CUSTOMIZE_ITEM_ID, resolveItemButton } from './registry';
import { ToolbarCustomizeButton } from './ToolbarCustomizeButton';
import type { ToolbarItem } from './types';

interface ToolbarLeafProps {
  item: ToolbarItem;
  editor: Editor;
  t: TFunction;
  /**
   * A labelled row in a collapsed family's menu: the same button and action (ADR 0011,
   * decision 7), but on touch the row's name is the only label the control gets.
   */
  inMenu?: boolean;
}

/** Renders nothing for an unmounted extension, which costs its own button, not the bar. */
export const ToolbarLeaf: React.FC<ToolbarLeafProps> = ({ item, editor, t, inMenu }) => {
  const combo = useShortcuts().bindings[item.id];
  // The one Item with no extension behind it: it changes the bar, not the note,
  // so the bar owns it rather than resolving it through TipTap.
  if (item.id === CUSTOMIZE_ITEM_ID) return <ToolbarCustomizeButton />;

  const view = resolveItemButton(item, { editor, t });
  if (!view) return null;
  const { component: Component } = view;
  const componentProps = {
    ...view.componentProps,
    shortcutKeys: combo ? comboParts(combo) : undefined,
  };

  if (!inMenu) return <Component {...componentProps} />;

  // The row is named through context, not props, and shows no shortcut: why both,
  // editor/CLAUDE.md (`ActionButton`).
  return (
    <MenuRowLabelProvider value={t(item.labelKey)}>
      <Component {...componentProps} />
    </MenuRowLabelProvider>
  );
};

export default ToolbarLeaf;
