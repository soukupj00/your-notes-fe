import { describe, expect, it } from 'vitest';
import { placeCallout } from './welcome.ts';

const PHONE = { width: 390, height: 844 };
const options = { width: 256, gap: 18 };

describe('placeCallout', () => {
  it('hangs below a target in the top half, centred on it', () => {
    const bar = { left: 100, top: 90, width: 190, height: 44 };

    expect(placeCallout(bar, PHONE, options)).toEqual({
      side: 'below',
      left: 67,
      offset: 152,
      arrow: 128,
    });
  });

  it('stands above a target in the bottom half, measured from the bottom edge', () => {
    const fab = { left: 318, top: 764, width: 56, height: 56 };

    const placement = placeCallout(fab, PHONE, options);

    expect(placement.side).toBe('above');
    expect(placement.offset).toBe(844 - 764 + 18);
  });

  it('stays inside the gutter at the screen edge, its arrow still under the target', () => {
    const gear = { left: 330, top: 8, width: 44, height: 44 };

    const placement = placeCallout(gear, PHONE, options);

    expect(placement.left).toBe(390 - 16 - 256);
    expect(placement.left + placement.arrow).toBe(352);
  });

  it('keeps the arrow out of the rounded corner when the target is past it', () => {
    const corner = { left: 380, top: 8, width: 10, height: 10 };

    expect(placeCallout(corner, PHONE, options).arrow).toBe(256 - 20);
  });
});
