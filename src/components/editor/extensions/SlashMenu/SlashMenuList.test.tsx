import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SlashMenuList, type SlashMenuListHandle } from './SlashMenuList';
import type { SlashItem } from './slashItems';

const t = (key: string) => key;

// Real registry ids: the list resolves its icon and its name through the
// registry now, so a made-up key would render a row with neither.
const items: SlashItem[] = [
  { key: 'bullet-list', keywords: [], run: vi.fn() },
  { key: 'blockquote', keywords: [], run: vi.fn() },
  { key: 'divider', keywords: [], run: vi.fn() },
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

  // The list scrolls but never holds focus, so the browser will not follow the
  // highlight on its own: arrowing past the visible rows moved an indicator the
  // user could no longer see.
  it('scrolls the highlighted row into view as the selection moves', () => {
    const scrollIntoView = vi.fn();
    // jsdom implements no layout, so this method does not exist there at all.
    Element.prototype.scrollIntoView = scrollIntoView;

    const { ref } = renderList();
    scrollIntoView.mockClear();

    press(ref, 'ArrowDown');

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('says so when a query matches nothing, rather than showing an empty box', () => {
    render(<SlashMenuList items={[]} command={vi.fn()} t={t} />);
    expect(screen.getByText('editor.slash.noResults')).toBeInTheDocument();
  });
});
