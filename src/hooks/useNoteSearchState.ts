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
 * The search box sits in the Navbar above the outlet, so it asks: off a feed route there is
 * nothing to filter, and a search box that does nothing is worse than none.
 */
export function useIsFeedRoute(): boolean {
  const matchRoute = useMatchRoute();
  return FEED_ROUTES.some((to) => Boolean(matchRoute({ to })));
}

/**
 * The feed's search state, with the URL as the single source of truth. Text edits `replace`
 * (typing is not navigation); sort and tag changes push, so back undoes them.
 */
export function useNoteSearchState() {
  const params = useSearch({ strict: false }) as NoteSearchParams;
  const navigate = useNavigate();
  const search = resolveNoteSearch(params);

  const setSearch = useCallback(
    (patch: Partial<ResolvedNoteSearch>, options?: { replace?: boolean }) => {
      void navigate({
        to: '.',
        search: (prev: NoteSearchParams) => ({
          ...toNoteSearchParams({ ...resolveNoteSearch(prev), ...patch }),
          // `note` is not feed state, so carry it across: on desktop the search box sits behind
          // the open editor, and dropping it would close the note (ADR 0014).
          note: prev.note,
        }),
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
