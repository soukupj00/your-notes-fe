import { describe, expect, it } from 'vitest';
import { resolveTopbar, type TopbarConfig } from '@/components/nav/topbar.ts';

/**
 * The whole matrix in one table. This is the payoff of `resolveTopbar` being a
 * pure function of the pathname: the rule that shapes the entire bar is
 * assertable without mounting a router, a provider or a database.
 */
const CASES: [pathname: string, expected: TopbarConfig][] = [
  ['/', { kind: 'feed', title: null, parent: '/' }],
  ['/archive', { kind: 'feed', title: { kind: 'key', key: 'nav.archive' }, parent: '/' }],
  ['/trash', { kind: 'feed', title: { kind: 'key', key: 'nav.trash' }, parent: '/' }],
  ['/tag/t1', { kind: 'feed', title: { kind: 'tag', id: 't1' }, parent: '/' }],
  ['/settings', { kind: 'page', title: { kind: 'key', key: 'nav.settings' }, parent: '/' }],
  [
    '/settings/labels',
    { kind: 'page', title: { kind: 'key', key: 'nav.labels' }, parent: '/settings' },
  ],
];

describe('resolveTopbar', () => {
  it.each(CASES)('resolves %s', (pathname, expected) => {
    expect(resolveTopbar(pathname)).toEqual(expected);
  });

  // The one rule the whole design rests on, asserted as a rule rather than as
  // six separate rows: if this ever drifts, the bar stops being predictable.
  it('gives the drawer trigger to feeds and back to everything else', () => {
    const feeds = ['/', '/archive', '/trash', '/tag/t1'];
    const pages = ['/settings', '/settings/labels'];

    for (const path of feeds) expect(resolveTopbar(path).kind).toBe('feed');
    for (const path of pages) expect(resolveTopbar(path).kind).toBe('page');
  });

  // `/` is the default surface: a title there would be the app telling the user
  // they are in the app.
  it('gives every feed but the default one a title', () => {
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
    expect(resolveTopbar('/')).toEqual({ kind: 'feed', title: null, parent: '/' });
  });

  // `/settings/labels` is nested under `/settings` and is *also* a drawer
  // destination. The nesting is what the fallback parent has to follow.
  it('walks the settings stack one level at a time', () => {
    expect(resolveTopbar('/settings/labels').parent).toBe('/settings');
    expect(resolveTopbar('/settings').parent).toBe('/');
  });

  // A page we do not recognise has no feed behind it, so a search box there
  // would filter nothing - and a way out is the one control it certainly needs.
  it('treats an unknown path as a dead end, not a feed', () => {
    expect(resolveTopbar('/nope')).toEqual({ kind: 'page', title: null, parent: '/' });
    expect(resolveTopbar('/tag/t1/extra').kind).toBe('page');
  });
});
