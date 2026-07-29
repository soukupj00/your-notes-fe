import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTE_SEARCH,
  type ResolvedNoteSearch,
  resolveNoteSearch,
  toNoteSearchParams,
  validateNoteSearch,
} from './note-search-params.ts';

describe('validateNoteSearch', () => {
  it('keeps a well-formed query', () => {
    expect(
      validateNoteSearch({ q: 'cake', sort: 'title', dir: 'asc', tags: ['t1', 't2'] })
    ).toEqual({ q: 'cake', sort: 'title', dir: 'asc', tags: ['t1', 't2'] });
  });

  it('drops only the invalid field, keeping the rest of a hand-edited URL', () => {
    expect(validateNoteSearch({ q: 'cake', sort: 'banana', dir: 'sideways' })).toEqual({
      q: 'cake',
      sort: undefined,
      dir: undefined,
      tags: undefined,
    });
  });

  it('drops unknown params', () => {
    expect(validateNoteSearch({ q: 'cake', hack: '1' })).not.toHaveProperty('hack');
  });

  it('accepts an empty search', () => {
    expect(resolveNoteSearch(validateNoteSearch({}))).toEqual(DEFAULT_NOTE_SEARCH);
  });
});

describe('resolveNoteSearch', () => {
  it('fills the blanks with defaults', () => {
    expect(resolveNoteSearch({ q: 'cake' })).toEqual({ ...DEFAULT_NOTE_SEARCH, q: 'cake' });
  });
});

describe('toNoteSearchParams', () => {
  it('omits everything that is still at its default', () => {
    expect(toNoteSearchParams(DEFAULT_NOTE_SEARCH)).toEqual({
      q: undefined,
      sort: undefined,
      dir: undefined,
      tags: undefined,
    });
  });

  it('keeps what the user changed', () => {
    expect(toNoteSearchParams({ q: 'cake', sort: 'title', dir: 'asc', tags: ['t1'] })).toEqual({
      q: 'cake',
      sort: 'title',
      dir: 'asc',
      tags: ['t1'],
    });
  });

  it('treats a whitespace-only query as no query', () => {
    expect(toNoteSearchParams({ ...DEFAULT_NOTE_SEARCH, q: '   ' }).q).toBeUndefined();
  });

  it('round-trips through validation', () => {
    const search: ResolvedNoteSearch = { q: 'cake', sort: 'created', dir: 'asc', tags: ['t1'] };
    expect(resolveNoteSearch(validateNoteSearch(toNoteSearchParams(search)))).toEqual(search);
  });
});
