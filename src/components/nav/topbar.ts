/**
 * What the mobile topbar shows, derived from the route.
 *
 * A pure function of the pathname, deliberately, rather than route
 * `staticData` or a context the views register into:
 *
 * - `staticData` is static, and `/tag/$id`'s title is a live Dexie query, so
 *   the config would end up split across two mechanisms.
 * - The Navbar renders *above* the outlet, so a view registering its title into
 *   a context is a child writing to a parent during render - the class of bug
 *   `use-mobile.tsx` had to be fixed for, and one the pre-commit lint rejects.
 *
 * The cost is that the nav layer knows about every route rather than each route
 * declaring its own chrome. That is acceptable only because the route set is
 * closed; if routes start being added, this wants to become `staticData` plus a
 * separate resolver for dynamic titles.
 */

/** Where back goes when there is nothing in history to pop. */
export type BackTarget = '/' | '/settings';

/** A title the topbar can show, before it has been resolved to a string. */
export type TopbarTitle = { kind: 'key'; key: string } | { kind: 'tag'; id: string };

export type TopbarConfig = {
  /**
   * One discriminator rather than three booleans, because the rule really is
   * one rule: **the drawer trigger belongs to feed routes, and every other
   * surface gets back.** `feed` carries the trigger, the search box and the
   * settings gear; `page` carries a back arrow and nothing else.
   */
  kind: 'feed' | 'page';
  /** `null` on `/`: the default surface does not need to announce itself. */
  title: TopbarTitle | null;
  parent: BackTarget;
};

const TAG_ROUTE = /^\/tag\/([^/]+)$/;

/** Trailing slashes are a router detail; `/archive/` is `/archive`. */
function normalise(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function resolveTopbar(pathname: string): TopbarConfig {
  const path = normalise(pathname);

  switch (path) {
    case '/':
      return { kind: 'feed', title: null, parent: '/' };
    case '/archive':
      return { kind: 'feed', title: { kind: 'key', key: 'nav.archive' }, parent: '/' };
    case '/trash':
      return { kind: 'feed', title: { kind: 'key', key: 'nav.trash' }, parent: '/' };
    case '/settings':
      return { kind: 'page', title: { kind: 'key', key: 'nav.settings' }, parent: '/' };
    // `nav.labels`, not `nav.editLabels`: the sidebar entry has to disambiguate
    // itself from the list of labels beneath it, and the page itself does not.
    // This is the same string the page's own <h1> uses, which is the point.
    case '/settings/labels':
      return { kind: 'page', title: { kind: 'key', key: 'nav.labels' }, parent: '/settings' };
  }

  const tag = TAG_ROUTE.exec(path);
  if (tag) return { kind: 'feed', title: { kind: 'tag', id: tag[1] }, parent: '/' };

  // Anything unrecognised is a dead end rather than a feed: offering search over
  // a feed that is not there is the failure `useIsFeedRoute` already avoids, and
  // a way out is the one control such a page definitely needs.
  return { kind: 'page', title: null, parent: '/' };
}
