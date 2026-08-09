import { describe, expect, it } from 'vitest';
import { mergeHeldOrder } from './feed-rank.ts';

/** Minimal stand-in: `mergeHeldOrder` only ever reads `id`. */
const item = (id: string) => ({ id });
const items = (...ids: string[]) => ids.map(item);
const ids = <T extends { id: string }>(list: T[]) => list.map((entry) => entry.id);

describe('incumbents', () => {
  it('keeps the held order even when the fresh order disagrees', () => {
    // What an edit looks like: `c` was just written, so `updated desc` now ranks
    // it first. ADR 0012 says it must not move under the user.
    const merged = mergeHeldOrder(items('c', 'a', 'b'), ['a', 'b', 'c']);

    expect(ids(merged)).toEqual(['a', 'b', 'c']);
  });

  it('drops a note that has left the feed, so membership stays live', () => {
    const merged = mergeHeldOrder(items('a', 'c'), ['a', 'b', 'c']);

    expect(ids(merged)).toEqual(['a', 'c']);
  });

  it('treats an empty held order as no held order at all', () => {
    const merged = mergeHeldOrder(items('b', 'a'), []);

    expect(ids(merged)).toEqual(['b', 'a']);
  });
});

describe('newcomers', () => {
  it('puts a note that sorts first at the front (updated desc)', () => {
    const merged = mergeHeldOrder(items('new', 'b', 'a', 'c'), ['a', 'b', 'c']);

    expect(ids(merged)).toEqual(['new', 'a', 'b', 'c']);
  });

  it('puts a note that sorts last at the back (title asc)', () => {
    // The bug a naive front-insert would have: under `title asc` a new note
    // called "Zebra" belongs at the end, not the top.
    const merged = mergeHeldOrder(items('apple', 'banana', 'zebra'), ['banana', 'apple']);

    expect(ids(merged)).toEqual(['banana', 'apple', 'zebra']);
  });

  it('anchors a newcomer after the last incumbent that outranks it', () => {
    const merged = mergeHeldOrder(items('apple', 'mango', 'zebra'), ['zebra', 'apple']);

    expect(ids(merged)).toEqual(['zebra', 'apple', 'mango']);
  });

  it('keeps several newcomers sharing an anchor in fresh order', () => {
    const merged = mergeHeldOrder(items('n1', 'n2', 'a', 'b'), ['a', 'b']);

    expect(ids(merged)).toEqual(['n1', 'n2', 'a', 'b']);
  });

  it('interleaves newcomers around the incumbents they sort between', () => {
    const merged = mergeHeldOrder(items('a', 'n1', 'b', 'n2'), ['a', 'b']);

    expect(ids(merged)).toEqual(['a', 'n1', 'b', 'n2']);
  });
});

describe('edges', () => {
  it('returns an empty feed unchanged', () => {
    expect(mergeHeldOrder([], ['a', 'b'])).toEqual([]);
  });

  it('ignores held ids that are not in the feed at all', () => {
    const merged = mergeHeldOrder(items('a'), ['gone', 'a', 'also-gone']);

    expect(ids(merged)).toEqual(['a']);
  });

  it('never invents, drops or duplicates a note', () => {
    const fresh = items('c', 'n', 'a', 'b');
    const merged = mergeHeldOrder(fresh, ['a', 'b', 'c']);

    expect(ids(merged).slice().sort()).toEqual(['a', 'b', 'c', 'n']);
  });
});
