import { useMatchRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import {
  type NoteSearchParams,
  type ResolvedNoteSearch,
  resolveNoteSearch,
  toNoteSearchParams,
} from '@/lib/note-search-params.ts';

/** The routes that show a note feed - i.e. the ones that validate search params. */
const FEED_ROUTES = ['/', '/archive', '/trash', '/tag/$id'] as const;

/**
 * Whether the current route can be searched. The search box lives in the
 * Navbar, above the outlet, so it has to ask: on `/settings` there is no feed
 * to filter and a search box that does nothing is worse than no search box.
 */
export function useIsFeedRoute(): boolean {
  const matchRoute = useMatchRoute();
  return FEED_ROUTES.some((to) => Boolean(matchRoute({ to })));
}

/**
 * The feed's search state, read from and written to the URL.
 *
 * The URL is the single source of truth (there is no search context any more):
 * a query survives a refresh, is shareable, and the back button steps through
 * filter changes. `to: '.'` keeps whichever feed route is current.
 *
 * `replace` exists because typing is not navigation - a nine-character query
 * should not leave nine entries in the history. Text edits replace; deliberate
 * filter changes (sort, tag pills) push, so back undoes them.
 */
export function useNoteSearchState() {
  const params = useSearch({ strict: false }) as NoteSearchParams;
  const navigate = useNavigate();
  const search = resolveNoteSearch(params);

  const setSearch = useCallback(
    (patch: Partial<ResolvedNoteSearch>, options?: { replace?: boolean }) => {
      // Fire-and-forget: the router owns the transition, there is nothing to await.
      void navigate({
        to: '.',
        search: (prev: NoteSearchParams) =>
          toNoteSearchParams({ ...resolveNoteSearch(prev), ...patch }),
        replace: options?.replace ?? false,
      });
    },
    [navigate]
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      const next = search.tags.includes(tagId)
        ? search.tags.filter((id) => id !== tagId)
        : [...search.tags, tagId];
      setSearch({ tags: next });
    },
    [search.tags, setSearch]
  );

  return { search, setSearch, toggleTag };
}
