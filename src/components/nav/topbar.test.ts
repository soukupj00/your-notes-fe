import { describe, expect, it } from 'vitest';
import { resolveTopbar, type TopbarConfig } from '@/components/nav/topbar.ts';

/**
 * The whole matrix in one table. This is the payoff of `resolveTopbar` being a
 * pure function of the pathname: the rule that shapes the entire bar is
 * assertable without mounting a router, a provider or a database.
 */
const CASES: [pathname: string, expected: TopbarConfig][] = [
  ['/', { kind: 'destination', title: null }],
  ['/archive', { kind: 'destination', title: { kind: 'key', key: 'nav.archive' } }],
  ['/trash', { kind: 'destination', title: { kind: 'key', key: 'nav.trash' } }],
  ['/tag/t1', { kind: 'destination', title: { kind: 'tag', id: 't1' } }],
  ['/labels', { kind: 'destination', title: { kind: 'key', key: 'nav.labels' } }],
  ['/settings', { kind: 'child', title: { kind: 'key', key: 'nav.settings' } }],
];

describe('resolveTopbar', () => {
  it.each(CASES)('resolves %s', (pathname, expected) => {
    expect(resolveTopbar(pathname)).toEqual(expected);
  });

  // The one rule the whole design rests on, asserted as a rule rather than as
  // six separate rows: if this ever drifts, the bar stops being predictable.
  it('gives the nav control to Destinations and back to everything else', () => {
    // Every entry in `navItems.ts` is here, which is the point: the drawer
    // offering a route and that route offering back to somewhere else was the
    // exact drift this asserts against.
    const destinations = ['/', '/archive', '/trash', '/tag/t1', '/labels'];
    const children = ['/settings'];

    for (const path of destinations) expect(resolveTopbar(path).kind).toBe('destination');
    for (const path of children) expect(resolveTopbar(path).kind).toBe('child');
  });

  // `/` is the default surface: a title there would be the app telling the user
  // they are in the app.
  it('gives every Destination but the default one a title', () => {
    expect(resolveTopbar('/').title).toBeNull();
    for (const path of ['/archive', '/trash', '/tag/t1']) {
      expect(resolveTopbar(path).title).not.toBeNull();
    }
  });

  it('reads the tag id out of the path', () => {
    expect(resolveTopbar('/tag/9f8e-1234').title).toEqual({ kind: 'tag', id: '9f8e-1234' });
  });

  it('ignores a trailing slash', () => {
    expect(resolveTopbar('/archive/')).toEqual(resolveTopbar('/archive'));
    expect(resolveTopbar('/')).toEqual({ kind: 'destination', title: null });
  });

  // A path we do not recognise cannot be in the nav, so a trigger there would
  // open a drawer with nothing marked active - and a way out is the one control
  // it certainly needs.
  it('treats an unknown path as a dead end, not a Destination', () => {
    expect(resolveTopbar('/nope')).toEqual({ kind: 'child', title: null });
    expect(resolveTopbar('/tag/t1/extra').kind).toBe('child');
  });
});
