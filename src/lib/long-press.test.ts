import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachLongPress } from './long-press';

function pointer(type: string, target: Element, init: Partial<PointerEventInit> = {}) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: 0, clientY: 0, ...init })
  );
}

describe('attachLongPress', () => {
  let root: HTMLDivElement;
  let row: HTMLLIElement;
  let onLongPress: ReturnType<typeof vi.fn>;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    row = document.createElement('li');
    root.append(row);
    document.body.append(root);
    onLongPress = vi.fn();
    detach = attachLongPress(root, { isTarget: (t) => t === row, onLongPress, delayMs: 500 });
  });

  afterEach(() => {
    detach();
    root.remove();
    vi.useRealTimers();
  });

  it('fires after the delay when the finger holds still', () => {
    pointer('pointerdown', row);
    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledWith(row);
  });

  it('does not fire when the finger lifts first', () => {
    pointer('pointerdown', row);
    vi.advanceTimersByTime(200);
    pointer('pointerup', row);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not fire when the finger travels, because that is a scroll', () => {
    pointer('pointerdown', row);
    pointer('pointermove', row, { clientX: 0, clientY: 15 });
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores a mouse, whose press-and-hold is text selection', () => {
    pointer('pointerdown', row, { pointerType: 'mouse' });
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores a press outside its targets', () => {
    pointer('pointerdown', root);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('swallows the click and context menu that follow a fired press', () => {
    pointer('pointerdown', row);
    vi.advanceTimersByTime(500);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    row.dispatchEvent(menu);
    row.dispatchEvent(click);
    expect(menu.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);
    // Only the one press: the next click goes through.
    const next = new MouseEvent('click', { bubbles: true, cancelable: true });
    row.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
  });

  it('detaches cleanly', () => {
    detach();
    pointer('pointerdown', row);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
    detach = () => {};
  });
});
