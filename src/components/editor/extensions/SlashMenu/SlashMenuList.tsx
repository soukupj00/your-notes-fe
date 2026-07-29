import { forwardRef, useImperativeHandle, useState } from 'react';
import { icons } from '@/components/icons';
import { cn } from '@/lib/utils.ts';
import type { TFunction } from '../button-types';
import type { SlashItem } from './slashItems';

export interface SlashMenuListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  t: TFunction;
}

/** What the Suggestion plugin calls on the rendered list to steer it. */
export interface SlashMenuListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * The floating list itself. Arrow keys and Enter are handled here (forwarded by
 * the Suggestion plugin) rather than by focusing the list: focus has to stay in
 * the document, or typing the query would stop working the moment the menu
 * opened.
 */
export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(
  function SlashMenuList({ items, command, t }, ref) {
    const [selected, setSelected] = useState(0);
    const [syncedItems, setSyncedItems] = useState(items);

    // Every keystroke hands down a freshly filtered array, so this resets the
    // highlight to the top as the query narrows - which is what the user
    // expects, and also keeps the index from pointing past a shorter list.
    // Adjusting state during render rather than in an effect: the effect
    // version renders twice per keystroke, under an open menu.
    if (items !== syncedItems) {
      setSyncedItems(items);
      setSelected(0);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === 'ArrowUp') {
          setSelected((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelected((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          command(items[selected]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-md border bg-popover px-3 py-2 text-muted-foreground text-sm shadow-md">
          {t('editor.slash.noResults')}
        </div>
      );
    }

    return (
      <ul className="max-h-72 w-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        {items.map((item, index) => {
          const Icon = icons[item.icon];
          return (
            <li key={item.key}>
              <button
                type="button"
                // The list never takes focus, so `aria-selected` on a focusless
                // list would be a lie; the highlight is the affordance.
                onMouseEnter={() => setSelected(index)}
                onClick={() => command(item)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  index === selected && 'bg-accent text-accent-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
);
