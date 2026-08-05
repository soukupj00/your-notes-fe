import { describe, expect, it } from 'vitest';
import { defaultToolbarLayout, toolbarPreset } from './presets';
import { TOOLBAR_FAMILIES } from './registry';
import { reconcileLayout, resolveLayout } from './resolveLayout';
import type { ToolbarLayout } from './types';

/** A Layout with only what a test names, as a blob written by an older build would be. */
function storedLayout(...families: ToolbarLayout): ToolbarLayout {
  return families;
}

describe('reconcileLayout', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(reconcileLayout(undefined, 'wide')).toEqual(defaultToolbarLayout('wide'));
    expect(reconcileLayout(undefined, 'compact')).toEqual(defaultToolbarLayout('compact'));
  });

  it('treats the empty array the schema defaults to as never customised', () => {
    // Reconciling `[]` entry by entry would rebuild the bar in registry order,
    // which is not the same arrangement as the default preset.
    expect(reconcileLayout([], 'wide')).toEqual(defaultToolbarLayout('wide'));
  });

  it('appends a registry family the blob has never heard of, at its registry position', () => {
    // An old blob that predates `block` and `media`: they sit between `list` and
    // `font` in the registry, and must land there rather than at the end.
    const stored = storedLayout(
      { id: 'list', on: true, collapsed: false, members: [{ id: 'bullet-list', on: true }] },
      { id: 'font', on: true, collapsed: false, members: [] }
    );

    const ids = reconcileLayout(stored, 'wide').map((family) => family.id);
    expect(ids.indexOf('block')).toBeGreaterThan(ids.indexOf('list'));
    expect(ids.indexOf('block')).toBeLessThan(ids.indexOf('font'));
    expect(ids.indexOf('media')).toBeGreaterThan(ids.indexOf('block'));
    expect(new Set(ids)).toEqual(new Set(TOOLBAR_FAMILIES.map((family) => family.id)));
  });

  it('gives a newly appeared family and leaf their default state, not off', () => {
    const stored = storedLayout({
      id: 'list',
      on: true,
      collapsed: false,
      members: [{ id: 'bullet-list', on: true }],
    });

    const reconciled = reconcileLayout(stored, 'wide');
    const media = reconciled.find((family) => family.id === 'media');
    // `media` is on in the Wide default, so a user who never saw it gets it on.
    expect(media?.on).toBe(true);
    // A leaf the blob predates joins its family in registry position, on.
    const list = reconciled.find((family) => family.id === 'list');
    expect(list?.members.map((member) => member.id)).toEqual([
      'bullet-list',
      'ordered-list',
      'task-list',
    ]);
    expect(list?.members.every((member) => member.on)).toBe(true);
  });

  it('keeps a stored id the registry does not know, so an arrangement survives', () => {
    const stored = storedLayout(
      { id: 'list', on: true, collapsed: false, members: [{ id: 'bullet-list', on: true }] },
      { id: 'from-the-future', on: true, collapsed: false, members: [{ id: 'teleport', on: true }] }
    );

    const reconciled = reconcileLayout(stored, 'wide');
    expect(reconciled.find((family) => family.id === 'from-the-future')).toEqual({
      id: 'from-the-future',
      on: true,
      collapsed: false,
      members: [{ id: 'teleport', on: true }],
    });
  });

  it('preserves the user order of the families the blob does know', () => {
    const stored = defaultToolbarLayout('wide');
    const reversed = [...stored].reverse();
    expect(reconcileLayout(reversed, 'wide').map((family) => family.id)).toEqual(
      reversed.map((family) => family.id)
    );
  });
});

describe('resolveLayout', () => {
  it('renders families in stored order, with only the leaves that are on', () => {
    const stored = storedLayout(
      {
        id: 'format',
        on: true,
        collapsed: false,
        // Every format leaf named, so this asserts order and `on` alone - a
        // partial list would also pull in the reconciliation covered above.
        members: [
          { id: 'italic', on: true },
          { id: 'bold', on: true },
          { id: 'strike', on: false },
          { id: 'underline', on: false },
          { id: 'code', on: false },
          { id: 'link', on: false },
          { id: 'clear', on: false },
        ],
      },
      { id: 'list', on: true, collapsed: true, members: [{ id: 'task-list', on: true }] }
    );

    const resolved = resolveLayout(stored, 'wide');
    const format = resolved.find((entry) => entry.family.id === 'format');
    // Order is the user's, not the registry's.
    expect(format?.items.map((item) => item.id)).toEqual(['italic', 'bold']);
    expect(resolved.find((entry) => entry.family.id === 'list')?.collapsed).toBe(true);
  });

  it('drops a family that is off, and one whose every leaf is off', () => {
    const stored = defaultToolbarLayout('wide').map((family) =>
      family.id === 'format'
        ? { ...family, members: family.members.map((member) => ({ ...member, on: false })) }
        : family.id === 'list'
          ? { ...family, on: false }
          : family
    );

    const ids = resolveLayout(stored, 'wide').map((entry) => entry.family.id);
    expect(ids).not.toContain('format');
    expect(ids).not.toContain('list');
    expect(ids).toContain('media');
  });

  it('does not render a stored family the registry does not know', () => {
    const stored = storedLayout({
      id: 'from-the-future',
      on: true,
      collapsed: false,
      members: [{ id: 'teleport', on: true }],
    });
    expect(resolveLayout(stored, 'wide').map((entry) => entry.family.id)).not.toContain(
      'from-the-future'
    );
  });

  it('ignores `collapsed` on a family that cannot collapse', () => {
    const stored = storedLayout({
      id: 'meta',
      on: true,
      collapsed: true,
      members: [{ id: 'customize', on: true }],
    });
    expect(resolveLayout(stored, 'wide')[0]?.collapsed).toBe(false);
  });

  it('gives each Width Class its own default arrangement', () => {
    const wide = resolveLayout(undefined, 'wide').map((entry) => entry.family.id);
    const compact = resolveLayout(undefined, 'compact').map((entry) => entry.family.id);
    expect(wide).not.toEqual(compact);
    // Wide has slots to spare, so it keeps the in-editor way back into the
    // settings. Compact does not: six is all a 360px phone fits, and the gear
    // is a door to a screen `/settings` already reaches, not an editing
    // control. It is one toggle away for anyone who wants it there.
    expect(wide).toContain('meta');
    expect(compact).not.toContain('meta');
  });

  it('opens the phone bar with undo and redo as real buttons', () => {
    // A phone has no Ctrl+Z, so undo may not cost a tap to *reach* before it
    // costs one to use - and being first, history is also the pinned family,
    // so it stays put while the rest of the bar scrolls under it.
    const compact = resolveLayout(undefined, 'compact');
    expect(compact[0]?.family.id).toBe('history');
    expect(compact[0]?.collapsed).toBe(false);
    expect(compact[0]?.items.map((item) => item.id)).toEqual(['undo', 'redo']);
  });

  it('renders every preset without dropping the whole bar', () => {
    for (const width of ['compact', 'wide'] as const) {
      for (const preset of ['minimal', 'balanced', 'everything'] as const) {
        expect(resolveLayout(toolbarPreset(preset, width), width).length).toBeGreaterThan(0);
      }
    }
  });
});
