import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureRows, playRows } from './flip-rows.ts';

/** jsdom has no layout, so rects are stubbed per element; `vi.restoreAllMocks` undoes it. */
function layout(element: Element, top: number, height = 20) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

/** A container holding `lists` task lists, each with the given row count. */
function build(...lists: number[]) {
  const root = document.createElement('div');
  root.innerHTML = lists
    .map(
      (rows) =>
        `<ul data-type="taskList">${'<li data-type="taskItem"><p>x</p></li>'.repeat(rows)}</ul>`
    )
    .join('');
  document.body.appendChild(root);
  return root;
}

/** Place a list at `listTop` and its rows at the given absolute tops. */
function place(root: Element, listIndex: number, listTop: number, rowTops: number[]) {
  const list = root.querySelectorAll('ul')[listIndex];
  layout(list, listTop);
  list.querySelectorAll('li').forEach((row, i) => {
    layout(row, rowTops[i]);
  });
}

/** Replace `animate` with a spy on every row, and hand back the calls. */
function spyOnAnimations(root: Element) {
  const calls: { row: number; from: string }[] = [];
  root.querySelectorAll('li').forEach((row, i) => {
    (row as HTMLElement).animate = vi.fn((keyframes: unknown) => {
      const first = (keyframes as { transform: string }[])[0];
      calls.push({ row: i, from: first.transform });
      return { finished: Promise.resolve() } as unknown as Animation;
    }) as unknown as Element['animate'];
  });
  return calls;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('captureRows', () => {
  it('records each row as an offset from its own list, not from the viewport', () => {
    // Offsets rather than absolute tops so a snapshot survives the page
    // scrolling, or the card itself moving, between capture and play.
    const root = build(3);
    place(root, 0, 100, [100, 130, 160]);

    expect(captureRows(root)).toEqual([[0, 30, 60]]);
  });

  it('keeps each list separate', () => {
    const root = build(2, 2);
    place(root, 0, 0, [0, 20]);
    place(root, 1, 500, [500, 540]);

    expect(captureRows(root)).toEqual([
      [0, 20],
      [0, 40],
    ]);
  });

  it('returns nothing for a container with no checklist', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>just prose</p>';
    document.body.appendChild(root);

    expect(captureRows(root)).toEqual([]);
  });
});

describe('playRows', () => {
  it('animates a moved row from where it was to where it now is', () => {
    const root = build(3);
    place(root, 0, 0, [0, 30, 60]);
    const before = captureRows(root);

    // The first row sank to the bottom; the other two moved up one slot.
    vi.restoreAllMocks();
    place(root, 0, 0, [60, 0, 30]);
    const calls = spyOnAnimations(root);

    playRows(root, before);

    expect(calls).toEqual([
      { row: 0, from: 'translateY(-60px)' },
      { row: 1, from: 'translateY(30px)' },
      { row: 2, from: 'translateY(30px)' },
    ]);
  });

  it('leaves a row that did not move alone', () => {
    const root = build(2);
    place(root, 0, 0, [0, 30]);
    const before = captureRows(root);
    const calls = spyOnAnimations(root);

    playRows(root, before);

    expect(calls).toEqual([]);
  });

  it('matches lists by position, so a second checklist animates independently', () => {
    const root = build(2, 2);
    place(root, 0, 0, [0, 30]);
    place(root, 1, 500, [500, 530]);
    const before = captureRows(root);

    vi.restoreAllMocks();
    place(root, 0, 0, [0, 30]);
    place(root, 1, 500, [530, 500]);
    const calls = spyOnAnimations(root);

    playRows(root, before);

    expect(calls).toEqual([
      { row: 2, from: 'translateY(-30px)' },
      { row: 3, from: 'translateY(30px)' },
    ]);
  });

  it('does not animate a row that has no counterpart in the snapshot', () => {
    // A newly typed item has nowhere to travel from; sliding it in from an
    // arbitrary offset would be inventing motion the user did not cause.
    const root = build(2);
    place(root, 0, 0, [0, 30]);
    const before = captureRows(root);

    const list = root.querySelector('ul');
    if (!list) throw new Error('no list');
    list.insertAdjacentHTML('beforeend', '<li data-type="taskItem"><p>new</p></li>');
    vi.restoreAllMocks();
    place(root, 0, 0, [0, 30, 60]);
    const calls = spyOnAnimations(root);

    playRows(root, before);

    expect(calls).toEqual([]);
  });

  it('is a no-op when the snapshot is empty', () => {
    const root = build(2);
    place(root, 0, 0, [30, 0]);
    const calls = spyOnAnimations(root);

    playRows(root, []);

    expect(calls).toEqual([]);
  });
});
