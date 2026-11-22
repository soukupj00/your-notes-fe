import { describe, expect, it } from 'vitest';
import { moveById } from './move-by-id.ts';

const list = [
  { id: 'history', members: ['undo', 'redo'] },
  { id: 'style', members: ['h1', 'h2', 'h3'] },
  { id: 'list', members: ['bullet-list', 'ordered-list', 'task-list'] },
];

const ids = (result: typeof list) => result.map((entry) => entry.id);

describe('moveById', () => {
  it('moves an entry to where the one it was dropped on sits', () => {
    expect(ids(moveById(list, 'list', 'history'))).toEqual(['list', 'history', 'style']);
    expect(ids(moveById(list, 'history', 'list'))).toEqual(['style', 'list', 'history']);
  });

  it('leaves the list alone when a drag ends over nothing, or over itself', () => {
    expect(moveById(list, 'history', 'nowhere')).toBe(list);
    expect(moveById(list, 'history', 'history')).toBe(list);
  });

  it('does not touch the entries it moves past', () => {
    const moved = moveById(list, 'list', 'history');
    expect(moved.map((entry) => entry.members)).toEqual(
      ['list', 'history', 'style'].map((id) => list.find((entry) => entry.id === id)?.members)
    );
  });
});
