import type { Editor } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import type { TFunction } from '@/components/editor/extensions/button-types';
import type { IconName } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { canRenderItem, resolveItemButton } from './registry';
import { ToolbarLeaf } from './ToolbarLeaf';
import type { ToolbarFamily, ToolbarItem } from './types';

interface ToolbarFamilyMenuProps {
  family: ToolbarFamily;
  /** The family's leaves that are on, in the user's order. Never empty. */
  items: ToolbarItem[];
  editor: Editor;
  t: TFunction;
}

/**
 * Which icon a collapsed trigger wears.
 *
 * A state-reporting family shows whichever of its leaves is currently active -
 * `H2` inside a heading, the active list type, the current alignment - and falls
 * back to its own icon when none is (`¶` for `style`, which is the honest answer
 * to "what block am I in", not a blank).
 *
 * Collapsing costs information; this is what pays it back. Families where
 * several leaves can be active at once (`format`) do not report, because a
 * trigger showing only the first would be lying.
 */
export function triggerIcon(
  family: ToolbarFamily,
  items: ToolbarItem[],
  editor: Editor,
  t: TFunction
): IconName {
  if (!family.reportsState) return family.icon;
  const active = items.find(
    (item) => resolveItemButton(item, { editor, t })?.componentProps.isActive?.() === true
  );
  return active?.icon ?? family.icon;
}

/**
 * One collapsed family: a single trigger on the bar, with the family's **real**
 * leaf buttons inside its popover.
 *
 * The leaves are not re-implemented as menu items - they are the same
 * `ActionButton`s, with the same `isActive`, tooltips and shortcuts, so a
 * collapsed family behaves exactly like an expanded one with one extra tap.
 */
export const ToolbarFamilyMenu: React.FC<ToolbarFamilyMenuProps> = ({
  family,
  items,
  editor,
  t,
}) => {
  const [open, setOpen] = useState(false);

  // A trigger that opens an empty popover is worse than no trigger. The bar
  // already filters unmountable leaves out, so this is the standalone guard for
  // a caller that does not.
  const resolvable = items.filter((item) => canRenderItem(item, { editor, t }));
  if (resolvable.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ActionButton
          toggle
          icon={triggerIcon(family, resolvable, editor, t)}
          tooltip={t(family.labelKey)}
          isActive={() => open}
          className="w-auto shrink-0 gap-0.5 px-1.5"
          data-testid={`toolbar-family-${family.id}`}
        >
          {/* The chevron is what makes a menu look like a menu rather than a
              button whose icon keeps changing under the user. The same one the
              preview strip draws, so the picture in Settings matches the bar. */}
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </ActionButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        collisionPadding={8}
        className="w-auto min-w-[12rem] max-w-[min(90vw,18rem)] p-1"
      >
        <div className="flex flex-col">
          {resolvable.map((item) => (
            <ToolbarLeaf key={item.id} item={item} editor={editor} t={t} inMenu />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ToolbarFamilyMenu;
