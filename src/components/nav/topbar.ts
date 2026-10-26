/**
 * What the mobile topbar shows, as a pure function of the pathname: `staticData` cannot hold the
 * live tag title, and views registering into a context would write to a parent during render.
 * Fine while the route set is closed; past that, move to `staticData` plus a title resolver.
 */

/** A title the topbar can show, before it has been resolved to a string. */
export type TopbarTitle =
  | { kind: 'key'; key: string }
  | { kind: 'tag'; id: string }
  // The data page is named after the account, which a pathname cannot know.
  | { kind: 'settingsData' };

export type TopbarConfig = {
  /**
   * A Destination gets the nav trigger and the settings gear; a child gets only Back
   * (CONTEXT.md, Destination). Having a Feed is a separate question: `useIsFeedRoute`.
   */
  kind: 'destination' | 'child';
  /** `null` on `/`: the default surface does not need to announce itself. */
  title: TopbarTitle | null;
  /** Where Back goes on a cold entry, with no history to pop; the Feed when absent. */
  parent?: string;
};

const TAG_ROUTE = /^\/tag\/([^/]+)$/;

const SETTINGS_SUBPAGES: Record<string, TopbarTitle> = {
  '/settings/general': { kind: 'key', key: 'settings.pages.general' },
  '/settings/toolbar': { kind: 'key', key: 'settings.pages.toolbar' },
  '/settings/quick-capture': { kind: 'key', key: 'settings.pages.quickCapture' },
  '/settings/data': { kind: 'settingsData' },
  '/settings/account': { kind: 'key', key: 'settings.pages.account' },
  '/settings/shortcuts': { kind: 'key', key: 'settings.pages.shortcuts' },
};

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
    // `nav.labels`, not the sidebar's `nav.editLabels`: only the sidebar has to tell itself
    // apart from the labels listed under it. It matches the page's own <h1>.
    case '/labels':
      return { kind: 'destination', title: { kind: 'key', key: 'nav.labels' } };
    // A child: Settings is not in `navItems.ts`, so a drawer here would not list the current page.
    case '/settings':
      return { kind: 'child', title: { kind: 'key', key: 'nav.settings' } };
  }

  const subpage = SETTINGS_SUBPAGES[path];
  if (subpage) return { kind: 'child', title: subpage, parent: '/settings' };

  const tag = TAG_ROUTE.exec(path);
  if (tag) return { kind: 'destination', title: { kind: 'tag', id: tag[1] } };

  // An unknown route is a child: the nav cannot mark it active, and a dead end needs a way out.
  return { kind: 'child', title: null };
}
