import { describe, expect, it } from 'vitest';
import type { Tag } from '@/models';
import {
  type ArrangeKind,
  arrangedOrder,
  isCustomOrder,
  labelCollator,
  positionForMove,
  positionForNew,
  positionsInOrder,
  sortLabels,
} from './label-order.ts';

const at = '2026-10-22T00:00:00.000Z';
const tag = (name: string, extra: Partial<Tag> = {}): Tag => ({
  id: name,
  name,
  createdAt: at,
  updatedAt: at,
  ...extra,
});
const names = (tags: readonly Tag[]) => tags.map((entry) => entry.name);
const en = labelCollator('en');

/** A list as it would be after a drop, with the returned keys written onto it. */
function withPositions(tags: readonly Tag[], positions: Map<string, string>): Tag[] {
  return tags.map((entry) =>
    positions.has(entry.id) ? { ...entry, position: positions.get(entry.id) } : entry
  );
}

describe('the order', () => {
  it.each([
    {
      language: 'cs',
      input: ['Zahrada', 'Čtení', 'Cesty'],
      expected: ['Cesty', 'Čtení', 'Zahrada'],
    },
    { language: 'en', input: ['item 10', 'item 9'], expected: ['item 9', 'item 10'] },
  ])(
    'sorts A to Z by collation while nothing is positioned ($language)',
    ({ language, input, expected }) => {
      expect(
        names(
          sortLabels(
            input.map((name) => tag(name)),
            labelCollator(language)
          )
        )
      ).toEqual(expected);
    }
  );

  it('puts positioned labels first, by key then id', () => {
    const tags = [
      tag('Alpha'),
      { ...tag('one'), position: 'a1' },
      { ...tag('tie-y', { id: 'y' }), position: 'a0' },
      { ...tag('tie-x', { id: 'x' }), position: 'a0' },
    ];

    expect(names(sortLabels(tags, en))).toEqual(['tie-x', 'tie-y', 'one', 'Alpha']);
  });

  it('treats a cleared position like none', () => {
    const tags = [tag('Beta', { position: null }), tag('Alpha', { position: null })];

    expect(names(sortLabels(tags, en))).toEqual(['Alpha', 'Beta']);
    expect(isCustomOrder(tags)).toBe(false);
  });

  it('compares keys by code unit, not by locale', () => {
    const tags = [tag('lower', { position: 'a0' }), tag('upper', { position: 'Z0' })];

    expect(names(sortLabels(tags, en))).toEqual(['upper', 'lower']);
  });

  it('returns a sorted copy', () => {
    const tags = [tag('B'), tag('A')];

    sortLabels(tags, en);

    expect(names(tags)).toEqual(['B', 'A']);
  });

  it('a rename moves a label only while the order is alphabetical', () => {
    const plain = [tag('Ideas'), tag('Personal'), tag('Work')];
    const renamed = plain.map((entry) =>
      entry.id === 'Work' ? { ...entry, name: 'Admin' } : entry
    );
    expect(names(sortLabels(renamed, en))[0]).toBe('Admin');

    const custom = withPositions(plain, positionsInOrder(plain));
    const indexBefore = sortLabels(custom, en).findIndex((entry) => entry.id === 'Work');
    const customRenamed = custom.map((entry) =>
      entry.id === 'Work' ? { ...entry, name: 'Admin' } : entry
    );
    expect(sortLabels(customRenamed, en).findIndex((entry) => entry.id === 'Work')).toBe(
      indexBefore
    );
  });
});

describe('moving', () => {
  it('the first move positions every label in the new order', () => {
    const sorted = sortLabels([tag('A'), tag('B'), tag('C')], en);

    const positions = positionForMove(sorted, 'C', 'A');

    expect(positions.size).toBe(3);
    expect(names(sortLabels(withPositions(sorted, positions), en))).toEqual(['C', 'A', 'B']);
  });

  it('a later move writes only the moved label, between its new neighbours', () => {
    const plain = [tag('A'), tag('B'), tag('C')];
    const custom = sortLabels(withPositions(plain, positionsInOrder(plain)), en);

    const positions = positionForMove(custom, 'C', 'A');

    expect([...positions.keys()]).toEqual(['C']);
    expect(names(sortLabels(withPositions(custom, positions), en))).toEqual(['C', 'A', 'B']);
  });

  it('moves down as well as up', () => {
    const plain = [tag('A'), tag('B'), tag('C')];
    const custom = sortLabels(withPositions(plain, positionsInOrder(plain)), en);

    const positions = positionForMove(custom, 'A', 'B');

    expect(names(sortLabels(withPositions(custom, positions), en))).toEqual(['B', 'A', 'C']);
  });

  it('a move between two labels that share a key re-keys the list', () => {
    // Two devices can mint the same key, and there is no key strictly between a key and itself.
    const custom = sortLabels(
      [tag('A', { position: 'a0' }), tag('B', { position: 'a1' }), tag('C', { position: 'a1' })],
      en
    );

    const positions = positionForMove(custom, 'A', 'B');

    expect(positions.size).toBe(3);
    expect(names(sortLabels(withPositions(custom, positions), en))).toEqual(['B', 'A', 'C']);
  });

  it('writes nothing for a drop on itself or on nothing', () => {
    const sorted = sortLabels([tag('A'), tag('B')], en);

    expect(positionForMove(sorted, 'A', 'A').size).toBe(0);
    expect(positionForMove(sorted, 'A', 'gone').size).toBe(0);
  });
});

describe('a new label', () => {
  const custom = (() => {
    const order = [tag('Work'), tag('Ideas'), tag('Personal')];
    return withPositions(order, positionsInOrder(order));
  })();
  const placed = (name: string) => {
    const position = positionForNew(name, custom, en);
    return names(sortLabels([...custom, tag(name, { position })], en));
  };

  it('lands before the first name after it in a custom order', () => {
    expect(placed('Groceries')).toEqual(['Groceries', 'Work', 'Ideas', 'Personal']);
  });

  it('lands last when no name sorts after it', () => {
    expect(placed('Zoo')).toEqual(['Work', 'Ideas', 'Personal', 'Zoo']);
  });

  it('gets no position while nothing is positioned', () => {
    expect(positionForNew('Zoo', [tag('A'), tag('B')], en)).toBeUndefined();
  });
});

describe('arranging', () => {
  const tags = [
    tag('Beta', { createdAt: '2026-01-01T00:00:00.000Z' }),
    tag('alpha', { createdAt: '2026-03-01T00:00:00.000Z' }),
    tag('Gamma', { createdAt: '2026-02-01T00:00:00.000Z' }),
  ];

  it.each<[ArrangeKind, string[]]>([
    ['az', ['alpha', 'Beta', 'Gamma']],
    ['za', ['Gamma', 'Beta', 'alpha']],
    ['newest', ['alpha', 'Gamma', 'Beta']],
    ['oldest', ['Beta', 'Gamma', 'alpha']],
  ])('arranges %s', (kind, expected) => {
    const arranged = arrangedOrder(tags, kind, en);
    expect(names(arranged)).toEqual(expected);
    expect(names(sortLabels(withPositions(tags, positionsInOrder(arranged)), en))).toEqual(
      expected
    );
  });
});
