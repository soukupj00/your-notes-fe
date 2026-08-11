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

/** A title the topbar can show, before it has been resolved to a string. */
export type TopbarTitle = { kind: 'key'; key: string } | { kind: 'tag'; id: string };

export type TopbarConfig = {
  /**
   * One discriminator rather than three booleans, because the rule really is
   * one rule: **the nav control belongs to Destinations, and a page with a
   * parent gets back.** A `destination` carries the trigger and the settings
   * gear; a `child` carries a back arrow and nothing else.
   *
   * It used to say `feed` and `page`, and that name was the bug. `/settings/
   * labels` is in `navItems.ts` - the drawer lists it beside Notes, Archive and
   * Trash - so it was the one Destination of the four that offered back to a
   * parent the user had very likely never been on. Being a Destination and
   * having a Feed are different questions; the search box asks the second one
   * for itself, through `useIsFeedRoute`.
   */
  kind: 'destination' | 'child';
  /** `null` on `/`: the default surface does not need to announce itself. */
  title: TopbarTitle | null;
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
      return { kind: 'destination', title: null };
    case '/archive':
      return { kind: 'destination', title: { kind: 'key', key: 'nav.archive' } };
    case '/trash':
      return { kind: 'destination', title: { kind: 'key', key: 'nav.trash' } };
    // A Destination without a Feed, and a sibling of Archive and Trash rather
    // than a page inside Settings - `navItems.ts` has listed it beside them all
    // along, and the URL now says the same thing.
    //
    // `nav.labels`, not `nav.editLabels`: the sidebar entry has to disambiguate
    // itself from the list of labels beneath it, and the page itself does not.
    // This is the same string the page's own <h1> uses, which is the point.
    case '/labels':
      return { kind: 'destination', title: { kind: 'key', key: 'nav.labels' } };
    // A child, not a Destination: Settings is deliberately absent from
    // `navItems.ts` (the gear is its single entry point), so a nav control here
    // would open a drawer that does not list the page you are standing on.
    case '/settings':
      return { kind: 'child', title: { kind: 'key', key: 'nav.settings' } };
  }

  const tag = TAG_ROUTE.exec(path);
  if (tag) return { kind: 'destination', title: { kind: 'tag', id: tag[1] } };

  // Anything unrecognised is a dead end rather than a Destination: the nav
  // cannot list a route it does not know, so a trigger there would open a drawer
  // with nothing marked active, and a way out is the one control such a page
  // definitely needs.
  return { kind: 'child', title: null };
}
