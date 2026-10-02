import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { getToolbarItem } from '@/components/editor/toolbar/registry';
import { icons } from '@/components/icons';
import { cn } from '@/lib/utils.ts';
import type { TFunction } from '../button-types';
import { type SlashItem, slashItemLabelKey } from './slashItems';

export interface SlashMenuListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  t: TFunction;
}

/** What the Suggestion plugin calls on the rendered list to steer it. */
export interface SlashMenuListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/** Keys arrive forwarded by the Suggestion plugin. The list never takes focus, or typing
 *  the query would stop working the moment the menu opened. */
export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(
  function SlashMenuList({ items, command, t }, ref) {
    const [selected, setSelected] = useState(0);
    const [syncedItems, setSyncedItems] = useState(items);
    const listRef = useRef<HTMLUListElement>(null);

    // Each keystroke hands down a new filtered array: reset the highlight so it never points
    // past a shorter list. Done during render, because an effect renders twice per keystroke.
    if (items !== syncedItems) {
      setSyncedItems(items);
      setSelected(0);
    }

    // The list never holds focus, so the browser will not scroll to the highlight for us.
    // `nearest` leaves the list still while the highlight moves within the visible rows.
    useEffect(() => {
      const row = listRef.current?.children[selected];
      row?.scrollIntoView?.({ block: 'nearest' });
    }, [selected]);

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
      <ul
        ref={listRef}
        className="max-h-72 w-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {items.map((item, index) => {
          const registryItem = getToolbarItem(item.key);
          const Icon = registryItem ? icons[registryItem.icon] : null;
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
                {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                <span className="truncate">{t(slashItemLabelKey(item))}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
);
