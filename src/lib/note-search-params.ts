import { z } from 'zod';

export const NOTE_SORT_FIELDS = ['updated', 'created', 'title'] as const;
export type NoteSortField = (typeof NOTE_SORT_FIELDS)[number];

export const NOTE_SORT_DIRECTIONS = ['desc', 'asc'] as const;
export type NoteSortDirection = (typeof NOTE_SORT_DIRECTIONS)[number];

/**
 * All optional, because the router serialises whatever the object holds: defaults here would
 * stamp `?sort=updated&dir=desc` onto every link. `.catch()` per field, so `?sort=banana` loses
 * only that field.
 */
const noteSearchParamsSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(NOTE_SORT_FIELDS).optional().catch(undefined),
  dir: z.enum(NOTE_SORT_DIRECTIONS).optional().catch(undefined),
  tags: z.array(z.string()).optional().catch(undefined),
  /**
   * The open note (ADR 0014). Not feed state, so it never reaches `ResolvedNoteSearch`; it lives
   * here because a second `validateSearch` on the feed routes would be a second place to drift.
   */
  note: z.string().optional().catch(undefined),
});

export type NoteSearchParams = z.infer<typeof noteSearchParamsSchema>;

/** What the feed uses once the URL's blanks are filled in. */
export type ResolvedNoteSearch = {
  q: string;
  sort: NoteSortField;
  dir: NoteSortDirection;
  tags: string[];
};

export const DEFAULT_NOTE_SEARCH: ResolvedNoteSearch = {
  q: '',
  sort: 'updated',
  dir: 'desc',
  tags: [],
};

/** URL shape → feed shape. The single place the defaults are applied. */
export function resolveNoteSearch(params: NoteSearchParams | undefined): ResolvedNoteSearch {
  return {
    q: params?.q ?? DEFAULT_NOTE_SEARCH.q,
    sort: params?.sort ?? DEFAULT_NOTE_SEARCH.sort,
    dir: params?.dir ?? DEFAULT_NOTE_SEARCH.dir,
    tags: params?.tags ?? DEFAULT_NOTE_SEARCH.tags,
  };
}

/** Drops anything equal to the default, so the address bar shows only what the user changed. */
export function toNoteSearchParams(search: ResolvedNoteSearch): NoteSearchParams {
  return {
    q: search.q.trim() ? search.q : undefined,
    sort: search.sort === DEFAULT_NOTE_SEARCH.sort ? undefined : search.sort,
    dir: search.dir === DEFAULT_NOTE_SEARCH.dir ? undefined : search.dir,
    tags: search.tags.length > 0 ? search.tags : undefined,
  };
}

/** `validateSearch` for every feed route. Unknown params are dropped. */
export function validateNoteSearch(search: Record<string, unknown>): NoteSearchParams {
  return noteSearchParamsSchema.parse(search);
}
