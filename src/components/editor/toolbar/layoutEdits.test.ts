import { describe, expect, it } from 'vitest';
import { COMPACT_FOLD_SLOTS, familySlots, foldIndex } from './foldMarker';
import { moveFamily, moveMember, setMemberOn, updateFamily } from './layoutEdits';
import { defaultToolbarLayout } from './presets';
import { reconcileLayout } from './resolveLayout';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';

function family(id: string, members: string[], extra: Partial<ToolbarFamilyPref> = {}) {
  return {
    id,
    on: true,
    collapsed: false,
    members: members.map((member) => ({ id: member, on: true })),
    ...extra,
  };
}

const layout: ToolbarLayout = [
  family('history', ['undo', 'redo']),
  family('style', ['h1', 'h2', 'h3']),
  family('list', ['bullet-list', 'ordered-list', 'task-list']),
];

const ids = (result: ToolbarLayout) => result.map((entry) => entry.id);

describe('moveFamily', () => {
  it('moves a family to where the one it was dropped on sits', () => {
    expect(ids(moveFamily(layout, 'list', 'history'))).toEqual(['list', 'history', 'style']);
    expect(ids(moveFamily(layout, 'history', 'list'))).toEqual(['style', 'list', 'history']);
  });

  it('leaves the layout alone when a drag ends over nothing, or over itself', () => {
    expect(moveFamily(layout, 'history', 'nowhere')).toBe(layout);
    expect(moveFamily(layout, 'history', 'history')).toBe(layout);
  });

  it('does not touch the members of the families it moves past', () => {
    const moved = moveFamily(layout, 'list', 'history');
    expect(moved.map((entry) => entry.members)).toEqual(
      ['list', 'history', 'style'].map((id) => layout.find((entry) => entry.id === id)?.members)
    );
  });
});

describe('moveMember', () => {
  it('reorders leaves inside one family only', () => {
    const moved = moveMember(layout, 'style', 'h3', 'h1');
    expect(moved[1].members.map((member) => member.id)).toEqual(['h3', 'h1', 'h2']);
    expect(moved[0]).toBe(layout[0]);
    expect(moved[2]).toBe(layout[2]);
  });
});

describe('updateFamily and setMemberOn', () => {
  it('turns a family off without forgetting how it was arranged', () => {
    const off = updateFamily(layout, 'style', { on: false });
    expect(off[1].on).toBe(false);
    // Its leaves survive, so switching it back on restores the arrangement
    // rather than a default one.
    expect(off[1].members).toEqual(layout[1].members);
  });

  it('collapses a family', () => {
    expect(updateFamily(layout, 'list', { collapsed: true })[2].collapsed).toBe(true);
  });

  it('turns one leaf off and leaves its siblings alone', () => {
    const next = setMemberOn(layout, 'style', 'h2', false);
    expect(next[1].members).toEqual([
      { id: 'h1', on: true },
      { id: 'h2', on: false },
      { id: 'h3', on: true },
    ]);
  });

  // Decision 8 cuts both ways: an id this build cannot render is still the
  // user's arrangement, so editing around it must not drop it.
  it('keeps a stored family the registry has never heard of', () => {
    const stored: ToolbarLayout = [...layout, family('from-the-future', ['teleport'])];
    const edited = setMemberOn(
      updateFamily(stored, 'style', { on: false }),
      'list',
      'task-list',
      false
    );
    expect(edited.at(-1)).toEqual(stored.at(-1));
  });
});

describe('familySlots', () => {
  it('counts a collapsed family as its one trigger', () => {
    expect(familySlots(family('style', ['h1', 'h2', 'h3'], { collapsed: true }))).toBe(1);
  });

  it('counts an expanded family as the leaves that are on', () => {
    const partial = family('style', ['h1', 'h2', 'h3']);
    partial.members[1].on = false;
    expect(familySlots(partial)).toBe(2);
  });

  it('counts a family that draws nothing as nothing', () => {
    expect(familySlots(family('style', ['h1'], { on: false }))).toBe(0);
    expect(familySlots({ ...family('style', ['h1']), members: [{ id: 'h1', on: false }] })).toBe(0);
    // Stored but unrenderable: no trigger, so no slot.
    expect(familySlots(family('from-the-future', ['teleport'], { collapsed: true }))).toBe(0);
  });

  it('gives a non-collapsible family its leaves even when stored collapsed', () => {
    // `meta` is a single gear; a menu wrapped around one button is not a menu,
    // and the bar renders it expanded whatever the blob says.
    expect(familySlots(family('meta', ['customize'], { collapsed: true }))).toBe(1);
  });
});

describe('foldIndex', () => {
  it('reports no fold when the whole layout fits', () => {
    expect(foldIndex([family('history', ['undo', 'redo'])])).toBeNull();
  });

  it('marks the first row that does not fit', () => {
    const rows = [
      family('history', ['undo', 'redo']), // 2, total 2
      family('style', ['h1', 'h2', 'h3']), // 3, total 5
      family('list', ['bullet-list', 'ordered-list', 'task-list']), // 3, total 8 > 7
    ];
    expect(foldIndex(rows)).toBe(2);
  });

  it('marks above the first row when that row alone overflows the bar', () => {
    const rows = [
      family('format', ['bold', 'italic', 'underline', 'strike', 'code', 'link', 'clear', 'x']),
    ];
    expect(foldIndex(rows)).toBe(0);
  });

  it('puts the compact default entirely above the fold', () => {
    // The default phone bar is the one arrangement that must not need scrolling
    // to reach its own buttons.
    const compact = reconcileLayout(defaultToolbarLayout('compact'), 'compact');
    expect(foldIndex(compact)).toBeNull();
    expect(compact.reduce((total, entry) => total + familySlots(entry), 0)).toBeLessThanOrEqual(
      COMPACT_FOLD_SLOTS
    );
  });
});
