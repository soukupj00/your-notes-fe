import { describe, expect, it } from 'vitest';
import { calculateNoteFeedLayout } from './note-feed-layout.ts';

describe('calculateNoteFeedLayout', () => {
  it('centres Stack notes at the proposed 704px desktop reading width', () => {
    const layout = calculateNoteFeedLayout({
      mode: 'stack',
      containerWidth: 1000,
      gap: 14,
      minColumnWidth: 216,
      items: [
        { id: 'first', height: 100 },
        { id: 'second', height: 80 },
      ],
    });

    expect(layout.columns).toBe(1);
    expect(layout.itemWidth).toBe(704);
    expect(layout.placements).toEqual({
      first: { x: 148, y: 0, width: 704 },
      second: { x: 148, y: 114, width: 704 },
    });
    expect(layout.height).toBe(194);
  });

  it('packs notes into the shortest masonry column without changing reading order', () => {
    const layout = calculateNoteFeedLayout({
      mode: 'masonry',
      containerWidth: 700,
      gap: 14,
      minColumnWidth: 216,
      items: [
        { id: 'first', height: 200 },
        { id: 'second', height: 100 },
        { id: 'third', height: 80 },
        { id: 'fourth', height: 60 },
      ],
    });

    expect(layout.columns).toBe(3);
    expect(layout.itemWidth).toBe(224);
    expect(layout.placements).toEqual({
      first: { x: 0, y: 0, width: 224 },
      second: { x: 238, y: 0, width: 224 },
      third: { x: 476, y: 0, width: 224 },
      fourth: { x: 476, y: 94, width: 224 },
    });
    expect(layout.height).toBe(200);
  });
});
