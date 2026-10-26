import { describe, expect, it } from 'vitest';
import { resolveTopbar, type TopbarConfig } from '@/components/nav/topbar.ts';

// The whole matrix in one table, with no router, provider or database: `resolveTopbar` is pure.
const CASES: [pathname: string, expected: TopbarConfig][] = [
  ['/', { kind: 'destination', title: null }],
  ['/archive', { kind: 'destination', title: { kind: 'key', key: 'nav.archive' } }],
  ['/trash', { kind: 'destination', title: { kind: 'key', key: 'nav.trash' } }],
  ['/tag/t1', { kind: 'destination', title: { kind: 'tag', id: 't1' } }],
  ['/labels', { kind: 'destination', title: { kind: 'key', key: 'nav.labels' } }],
  ['/settings', { kind: 'child', title: { kind: 'key', key: 'nav.settings' } }],
];

const SETTINGS_SUBPAGES: [pathname: string, title: TopbarConfig['title']][] = [
  ['/settings/general', { kind: 'key', key: 'settings.pages.general' }],
  ['/settings/toolbar', { kind: 'key', key: 'settings.pages.toolbar' }],
  ['/settings/quick-capture', { kind: 'key', key: 'settings.pages.quickCapture' }],
  ['/settings/data', { kind: 'settingsData' }],
  ['/settings/account', { kind: 'key', key: 'settings.pages.account' }],
  ['/settings/shortcuts', { kind: 'key', key: 'settings.pages.shortcuts' }],
];

describe('resolveTopbar', () => {
  it.each(CASES)('resolves %s', (pathname, expected) => {
    expect(resolveTopbar(pathname)).toEqual(expected);
  });

  it.each(
    SETTINGS_SUBPAGES.flatMap(([path, title]) => [
      [path, title],
      [`${path}/`, title],
    ])
  )('resolves the Settings subpage %s as a child of the Settings home', (pathname, title) => {
    expect(resolveTopbar(pathname)).toEqual({ kind: 'child', title, parent: '/settings' });
  });

  it('gives the Settings home no parent of its own', () => {
    expect(resolveTopbar('/settings')).not.toHaveProperty('parent');
  });

  // The one rule the whole design rests on, asserted as a rule rather than as
  // six separate rows: if this ever drifts, the bar stops being predictable.
  it('gives the nav control to Destinations and back to everything else', () => {
    // Every `navItems.ts` entry is here: a drawer offering a route that then offers Back is the
    // drift this guards against.
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

  // An unknown path cannot be in the nav, so it gets the one control a dead end needs: a way out.
  it('treats an unknown path as a dead end, not a Destination', () => {
    expect(resolveTopbar('/nope')).toEqual({ kind: 'child', title: null });
    expect(resolveTopbar('/tag/t1/extra').kind).toBe('child');
  });
});
