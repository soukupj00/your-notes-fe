import { describe, expect, it } from 'vitest';
import type { Note } from '@/models.ts';
import { createNoteSearchIndex, type NoteSearchEntry, searchNotes } from './note-search.ts';

const now = new Date().toISOString();

function note(id: string, overrides: Partial<Note> = {}): Note {
  return { id, body: '', state: 'active', createdAt: now, updatedAt: now, ...overrides };
}

function entries(...items: NoteSearchEntry[]) {
  return createNoteSearchIndex(items);
}

const ids = (notes: Note[]) => notes.map((n) => n.id);

describe('searchNotes', () => {
  it('ranks an exact header match above an incidental body mention', () => {
    const index = entries(
      {
        note: note('body', { header: 'Weekend', body: '<p>buy groceries today</p>' }),
        tagNames: [],
      },
      { note: note('header', { header: 'Groceries' }), tagNames: [] }
    );

    expect(ids(searchNotes(index, 'groceries'))).toEqual(['header', 'body']);
  });

  it('still finds the note when the query is misspelled', () => {
    const index = entries({ note: note('a', { header: 'Groceries' }), tagNames: [] });

    expect(ids(searchNotes(index, 'grocerise'))).toEqual(['a']);
  });

  it('searches the body as plain text, not as HTML', () => {
    const index = entries({
      note: note('a', { header: 'x', body: '<p class="strong">Pancake <em>batter</em></p>' }),
      tagNames: [],
    });

    expect(ids(searchNotes(index, 'pancake batter'))).toEqual(['a']);
    // A query that only matches markup must not hit.
    expect(searchNotes(index, 'class')).toEqual([]);
  });

  it('matches a note through one of its tag names', () => {
    const index = entries(
      { note: note('tagged', { header: 'x' }), tagNames: ['Groceries'] },
      { note: note('untagged', { header: 'x' }), tagNames: [] }
    );

    expect(ids(searchNotes(index, 'groceries'))).toEqual(['tagged']);
  });

  it('returns nothing for a query that matches nothing', () => {
    const index = entries({ note: note('a', { header: 'Pancakes' }), tagNames: [] });

    expect(searchNotes(index, 'quantum')).toEqual([]);
  });

  it('is stable: the same query over the same index gives the same order', () => {
    const index = entries(
      { note: note('a', { header: 'Grocery list' }), tagNames: [] },
      { note: note('b', { header: 'Groceries' }), tagNames: [] },
      { note: note('c', { header: 'x', body: '<p>groceries</p>' }), tagNames: [] }
    );

    const first = ids(searchNotes(index, 'groceries'));
    expect(ids(searchNotes(index, 'groceries'))).toEqual(first);
    expect(first).toHaveLength(3);
  });
});
