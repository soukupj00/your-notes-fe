import type { Editor } from '@tiptap/react';
import type React from 'react';
import type { TFunction } from '@/components/editor/extensions/button-types';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { getShortcutKeys } from '@/utils/platform.ts';
import { resolveItemButton } from './registry';
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
   * differs, and it has to: a menu row has space for the name and the shortcut,
   * which is what a floating tooltip was doing badly, and on touch - where a
   * tooltip never appears at all - it is the only labelling the control gets.
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
  const view = resolveItemButton(item, { editor, t });
  if (!view) return null;
  const { component: Component, componentProps } = view;

  // Custom-component leaves (the colour pickers, the font selects) bring their
  // own trigger and do not take a label or children, so they render as-is even
  // in a menu. They are self-describing - a swatch and a select - which is why
  // they were built that way in the first place.
  if (!inMenu || Component !== ActionButton) {
    return <Component {...componentProps} />;
  }

  const shortcut = componentProps.shortcutKeys?.length
    ? getShortcutKeys(componentProps.shortcutKeys)
        .map((key) => key.symbol)
        .join(' + ')
    : undefined;

  return (
    <ActionButton
      {...componentProps}
      showTooltip={false}
      className="h-9 w-full justify-start gap-2 px-2"
    >
      <span className="flex-1 text-left font-normal text-sm">{t(item.labelKey)}</span>
      {shortcut && <span className="text-muted-foreground text-xs">{shortcut}</span>}
    </ActionButton>
  );
};

export default ToolbarLeaf;
