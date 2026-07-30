import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import type { NoteSearchParams } from '@/lib/note-search-params.ts';
import type { Note, NoteState } from '@/models.ts';
import { type NoteFeedScope, useNoteFeed } from './useNoteFeed.ts';

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

async function putNote(overrides: Partial<Note> & { id: string }): Promise<Note> {
  const now = new Date().toISOString();
  const note: Note = {
    header: overrides.id,
    body: '',
    state: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await db.notes.put(note);
  return note;
}

/** Render the hook and wait for the live query to settle. */
async function feed(scope: NoteFeedScope, search?: NoteSearchParams | string) {
  const params = typeof search === 'string' ? { q: search } : search;
  const { result } = renderHook(() => useNoteFeed(scope, params));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

async function putTag(id: string, noteIds: string[]) {
  const now = new Date().toISOString();
  await db.tags.put({ id, name: id, createdAt: now, updatedAt: now });
  for (const noteId of noteIds) {
    await db.noteTags.put({ noteId, tagId: id, createdAt: now, updatedAt: now });
  }
}

const ids = (notes: Note[]) => notes.map((n) => n.id);

afterEach(async () => {
  await db.notes.clear();
  await db.tags.clear();
  await db.noteTags.clear();
});

describe('scoping by state', () => {
  it.each<[NoteState, string]>([
    ['active', 'a'],
    ['archived', 'b'],
    ['trashed', 'c'],
  ])('a %s scope returns only the %s note', async (state, expected) => {
    await putNote({ id: 'a', state: 'active' });
    await putNote({ id: 'b', state: 'archived' });
    await putNote({ id: 'c', state: 'trashed', trashedAt: daysAgo(1) });

    const result = await feed({ state });

    expect(ids(result.current.notes)).toEqual([expected]);
  });

  it('narrows to a single tag when one is given', async () => {
    await putNote({ id: 'tagged' });
    await putNote({ id: 'untagged' });
    const now = new Date().toISOString();
    await db.tags.put({ id: 't1', name: 'Work', createdAt: now, updatedAt: now });
    await db.noteTags.put({ noteId: 'tagged', tagId: 't1', createdAt: now, updatedAt: now });

    const result = await feed({ state: 'active', tagId: 't1' });

    expect(ids(result.current.notes)).toEqual(['tagged']);
  });
});

describe('ordering', () => {
  it('floats pinned notes to the top, newest pin first, then by recency', async () => {
    await putNote({ id: 'old', updatedAt: daysAgo(9) });
    await putNote({ id: 'recent', updatedAt: daysAgo(1) });
    await putNote({ id: 'pinned-earlier', pinnedAt: daysAgo(6), updatedAt: daysAgo(8) });
    await putNote({ id: 'pinned-later', pinnedAt: daysAgo(2), updatedAt: daysAgo(9) });

    const result = await feed({ state: 'active' });

    expect(ids(result.current.notes)).toEqual(['pinned-later', 'pinned-earlier', 'recent', 'old']);
  });
});

describe('sorting', () => {
  it.each<[NoteSearchParams, string[]]>([
    [{ sort: 'updated', dir: 'desc' }, ['b', 'a', 'c']],
    [{ sort: 'updated', dir: 'asc' }, ['c', 'a', 'b']],
    [{ sort: 'created', dir: 'desc' }, ['c', 'b', 'a']],
    [{ sort: 'created', dir: 'asc' }, ['a', 'b', 'c']],
    [{ sort: 'title', dir: 'asc' }, ['a', 'b', 'c']],
    [{ sort: 'title', dir: 'desc' }, ['c', 'b', 'a']],
  ])('orders by %o', async (search, expected) => {
    await putNote({ id: 'a', header: 'Apples', createdAt: daysAgo(9), updatedAt: daysAgo(5) });
    await putNote({ id: 'b', header: 'Bread', createdAt: daysAgo(5), updatedAt: daysAgo(1) });
    await putNote({ id: 'c', header: 'Cheese', createdAt: daysAgo(1), updatedAt: daysAgo(9) });

    const result = await feed({ state: 'active' }, search);

    expect(ids(result.current.notes)).toEqual(expected);
  });

  it('keeps pinned notes on top whatever the sort', async () => {
    await putNote({ id: 'a', header: 'Apples', updatedAt: daysAgo(1) });
    await putNote({ id: 'z', header: 'Zebra', updatedAt: daysAgo(9), pinnedAt: daysAgo(2) });

    const byTitle = await feed({ state: 'active' }, { sort: 'title', dir: 'asc' });
    expect(ids(byTitle.current.notes)).toEqual(['z', 'a']);

    const byUpdated = await feed({ state: 'active' }, { sort: 'updated', dir: 'desc' });
    expect(ids(byUpdated.current.notes)).toEqual(['z', 'a']);
  });

  it('keeps pinned notes on top of search results too', async () => {
    await putNote({ id: 'best', header: 'Pancakes' });
    await putNote({ id: 'pinned', header: 'Pancake pan', pinnedAt: daysAgo(1) });

    const result = await feed({ state: 'active' }, 'pancakes');

    expect(ids(result.current.notes)[0]).toBe('pinned');
  });
});

describe('tag filters', () => {
  it('carries complete tag data with each note so cards mount at their final height', async () => {
    await putNote({ id: 'tagged' });
    await putTag('work', ['tagged']);

    const result = await feed({ state: 'active' });

    expect(result.current.notes[0]?.tags).toEqual([
      expect.objectContaining({ id: 'work', name: 'work' }),
    ]);
  });

  it('requires every selected tag (AND), not any of them', async () => {
    await putNote({ id: 'both' });
    await putNote({ id: 'only-work' });
    await putNote({ id: 'untagged' });
    await putTag('work', ['both', 'only-work']);
    await putTag('urgent', ['both']);

    const single = await feed({ state: 'active' }, { tags: ['work'] });
    expect(ids(single.current.notes).sort()).toEqual(['both', 'only-work']);

    const both = await feed({ state: 'active' }, { tags: ['work', 'urgent'] });
    expect(ids(both.current.notes)).toEqual(['both']);
  });

  it('narrows the text search rather than replacing it', async () => {
    await putNote({ id: 'match', header: 'Pancakes' });
    await putNote({ id: 'tag-only', header: 'Waffles' });
    await putTag('work', ['match', 'tag-only']);
    await putNote({ id: 'text-only', header: 'Pancakes elsewhere' });

    const result = await feed({ state: 'active' }, { q: 'pancakes', tags: ['work'] });

    expect(ids(result.current.notes)).toEqual(['match']);
  });
});

describe('search within a scope', () => {
  it('matches header, body and tag name', async () => {
    await putNote({ id: 'by-header', header: 'Groceries' });
    await putNote({ id: 'by-body', header: 'x', body: '<p>buy groceries today</p>' });
    await putNote({ id: 'by-tag', header: 'x' });
    await putNote({ id: 'no-match', header: 'x' });
    const now = new Date().toISOString();
    await db.tags.put({ id: 't1', name: 'Groceries', createdAt: now, updatedAt: now });
    await db.noteTags.put({ noteId: 'by-tag', tagId: 't1', createdAt: now, updatedAt: now });

    const result = await feed({ state: 'active' }, 'grocer');

    expect(ids(result.current.notes).sort()).toEqual(['by-body', 'by-header', 'by-tag']);
  });

  it('never surfaces trashed notes from a non-trash scope', async () => {
    await putNote({ id: 'live', header: 'Secret plan' });
    await putNote({ id: 'binned', header: 'Secret plan', state: 'trashed', trashedAt: daysAgo(1) });

    // ADR 0009: trashed notes are out of search entirely; they exist only in /trash.
    const active = await feed({ state: 'active' }, 'secret');
    expect(ids(active.current.notes)).toEqual(['live']);

    const archived = await feed({ state: 'archived' }, 'secret');
    expect(ids(archived.current.notes)).toEqual([]);
  });

  it('searches inside the archive when that is the current scope', async () => {
    await putNote({ id: 'archived-hit', header: 'Pancakes', state: 'archived' });
    await putNote({ id: 'archived-miss', header: 'Waffles', state: 'archived' });

    const result = await feed({ state: 'archived' }, 'pancake');

    expect(ids(result.current.notes)).toEqual(['archived-hit']);
  });

  it('tolerates a typo and ranks the header match first', async () => {
    await putNote({ id: 'body-hit', header: 'Weekend', body: '<p>buy groceries today</p>' });
    await putNote({ id: 'header-hit', header: 'Groceries' });
    await putNote({ id: 'no-match', header: 'Car service' });

    const result = await feed({ state: 'active' }, 'grocerise');

    expect(ids(result.current.notes)).toEqual(['header-hit', 'body-hit']);
  });

  it('a blank query is not a filter', async () => {
    await putNote({ id: 'a' });
    await putNote({ id: 'b' });

    const result = await feed({ state: 'active' }, '   ');

    expect(result.current.notes).toHaveLength(2);
  });
});
