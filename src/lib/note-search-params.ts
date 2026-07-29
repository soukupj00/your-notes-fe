import { z } from 'zod';

export const NOTE_SORT_FIELDS = ['updated', 'created', 'title'] as const;
export type NoteSortField = (typeof NOTE_SORT_FIELDS)[number];

export const NOTE_SORT_DIRECTIONS = ['desc', 'asc'] as const;
export type NoteSortDirection = (typeof NOTE_SORT_DIRECTIONS)[number];

/**
 * The feed's search/filter state, as it lives in the URL. Every field is
 * optional so an untouched feed stays at a clean `/` - the router serialises
 * exactly what the object holds, so carrying defaults here would stamp
 * `?sort=updated&dir=desc` onto every link.
 *
 * `.catch()` per field rather than on the object: a hand-edited `?sort=banana`
 * should lose the bad field, not the whole (possibly carefully typed) query.
 */
export const noteSearchParamsSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(NOTE_SORT_FIELDS).optional().catch(undefined),
  dir: z.enum(NOTE_SORT_DIRECTIONS).optional().catch(undefined),
  tags: z.array(z.string()).optional().catch(undefined),
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

/**
 * Feed shape → URL shape, dropping anything that equals the default so the
 * address bar only ever shows what the user actually changed.
 */
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
