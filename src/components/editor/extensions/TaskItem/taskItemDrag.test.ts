import { describe, expect, it } from 'vitest';
import { dropIndex } from './taskItemDrag';

/**
 * `dropIndex` turns "dropped after N of these rows" into the child index the
 * item takes once it has been removed from the list. The rows it may land among
 * are its own group (ADR 0013: with sinking on, checked and unchecked are shown
 * apart, so an item only ever moves within its half), in visual order.
 */
describe('dropIndex', () => {
  it('moves down: dropped after a later row', () => {
    // stored [A B C D], drag A after C -> [B C A D]
    expect(dropIndex(0, [1, 2, 3], 2)).toBe(2);
  });

  it('moves up: dropped before an earlier row', () => {
    // stored [A B C D], drag D before B -> [A D B C]
    expect(dropIndex(3, [0, 1, 2], 1)).toBe(1);
  });

  it('returns the same index when dropped where it was', () => {
    expect(dropIndex(1, [0, 2, 3], 1)).toBe(1);
  });

  it('lands at the very end', () => {
    expect(dropIndex(0, [1, 2, 3], 3)).toBe(3);
  });

  it('keeps to its group: a checked item shown at the bottom moves among the checked only', () => {
    // stored [u0 c1 u2 c3 c4], sinking shows [u0 u2 | c1 c3 c4]. Drag c4 to the
    // top of the checked group -> it goes before c1 -> stored index 1.
    expect(dropIndex(4, [1, 3], 0)).toBe(1);
  });

  it('is a no-op with nothing to land among', () => {
    expect(dropIndex(2, [], 0)).toBe(2);
  });
});
