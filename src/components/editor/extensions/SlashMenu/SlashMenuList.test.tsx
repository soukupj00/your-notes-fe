import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SlashMenuList, type SlashMenuListHandle } from './SlashMenuList';
import type { SlashItem } from './slashItems';

const t = (key: string) => key;

const items: SlashItem[] = [
  { key: 'a', icon: 'List', labelKey: 'first', keywords: [], run: vi.fn() },
  { key: 'b', icon: 'Quote', labelKey: 'second', keywords: [], run: vi.fn() },
  { key: 'c', icon: 'Minus', labelKey: 'third', keywords: [], run: vi.fn() },
];

function renderList(props: Partial<React.ComponentProps<typeof SlashMenuList>> = {}) {
  const ref = createRef<SlashMenuListHandle>();
  const command = props.command ?? vi.fn();
  render(<SlashMenuList ref={ref} items={items} command={command} t={t} {...props} />);
  return { ref, command };
}

/**
 * Key events arrive from the Suggestion plugin, not from a focused list, so
 * they are dispatched straight at the handle - wrapped in `act` because moving
 * the highlight is a state update React has to flush before the next press.
 */
function press(ref: React.RefObject<SlashMenuListHandle | null>, key: string) {
  let handled: boolean | undefined;
  act(() => {
    handled = ref.current?.onKeyDown({ event: new KeyboardEvent('keydown', { key }) });
  });
  return handled;
}

describe('SlashMenuList', () => {
  it('renders one option per item', () => {
    renderList();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('takes the top item when Enter is pressed without moving', () => {
    const { ref, command } = renderList();
    press(ref, 'Enter');
    expect(command).toHaveBeenCalledWith(items[0]);
  });

  it('walks the list with the arrow keys', () => {
    const { ref, command } = renderList();
    press(ref, 'ArrowDown');
    press(ref, 'ArrowDown');
    press(ref, 'Enter');
    expect(command).toHaveBeenCalledWith(items[2]);
  });

  // Wrapping matters: the list is short, so the fastest way to the last item is up.
  it('wraps around at both ends', () => {
    const { ref, command } = renderList();
    press(ref, 'ArrowUp');
    press(ref, 'Enter');
    expect(command).toHaveBeenCalledWith(items[2]);
  });

  it('leaves keys it does not own to the editor', () => {
    const { ref } = renderList();
    expect(press(ref, 'ArrowDown')).toBe(true);
    expect(press(ref, 'a')).toBe(false);
  });

  it('says so when a query matches nothing, rather than showing an empty box', () => {
    render(<SlashMenuList items={[]} command={vi.fn()} t={t} />);
    expect(screen.getByText('editor.slash.noResults')).toBeInTheDocument();
  });
});
