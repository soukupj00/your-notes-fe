import { describe, expect, it } from 'vitest';
import {
  assignShortcut,
  findConflict,
  refusalOf,
  resetShortcut,
  resolveShortcuts,
  SHORTCUTS,
  type ShortcutScope,
  shortcutFor,
} from './shortcuts.ts';

const defaults = resolveShortcuts({});

describe('SHORTCUTS', () => {
  it('lists the two app keys first, then the 22 editor shortcuts', () => {
    expect(SHORTCUTS.slice(0, 2).map((def) => [def.id, def.scope, def.defaultCombo])).toEqual([
      ['new-note', 'app', 'n'],
      ['search', 'app', 'Mod-k'],
    ]);
    expect(SHORTCUTS.filter((def) => def.scope === 'editor')).toHaveLength(22);
  });
});

describe('resolveShortcuts', () => {
  it('gives every default when nothing is stored', () => {
    expect(defaults.bold).toBe('Mod-b');
    expect(defaults.redo).toBe('Mod-Shift-z');
    expect(Object.keys(defaults)).toHaveLength(SHORTCUTS.length);
  });

  it('applies a changed and a cleared shortcut, and nothing else', () => {
    const bindings = resolveShortcuts({ bold: 'Mod-Alt-b', italic: null });
    expect(bindings).toEqual({ ...defaults, bold: 'Mod-Alt-b', italic: null });
  });

  it('falls back to the default for an unreadable value, and ignores unknown ids', () => {
    const bindings = resolveShortcuts({
      bold: 42 as never,
      nonsense: 'Mod-x',
      code: 'Mod-b-c',
      underline: '',
    });
    expect(bindings.bold).toBe('Mod-b');
    expect(bindings.code).toBe('Mod-e');
    expect(bindings.underline).toBe('Mod-u');
    expect(bindings).not.toHaveProperty('nonsense');
  });
});

describe('findConflict', () => {
  it('names the action in the same scope that has the combination', () => {
    expect(findConflict('blockquote', 'Mod-b', defaults)).toBe('bold');
  });

  it('ignores another scope, the action itself, and a cleared action', () => {
    expect(findConflict('search', 'Mod-k', defaults)).toBeNull();
    expect(findConflict('link', 'Mod-k', defaults)).toBeNull();
    expect(findConflict('bold', 'Mod-i', { ...defaults, italic: null })).toBeNull();
  });
});

describe('shortcutFor', () => {
  it('finds the action bound to a combination within a scope', () => {
    expect(shortcutFor('Mod-k', 'app', defaults)).toBe('search');
    expect(shortcutFor('Mod-k', 'editor', defaults)).toBe('link');
    expect(shortcutFor('Mod-Alt-q', 'editor', defaults)).toBeNull();
  });
});

describe('refusalOf', () => {
  it.each<[string, ShortcutScope, ReturnType<typeof refusalOf>]>([
    ['Mod-w', 'app', 'browser'],
    ['Mod-w', 'editor', 'browser'],
    ['Mod-Shift-Tab', 'editor', 'browser'],
    ['b', 'editor', 'needs-modifier'],
    ['Shift-b', 'editor', 'needs-modifier'],
    ['Mod-a', 'editor', 'editor'],
    ['Mod-Alt-0', 'editor', 'editor'],
    ['Mod-a', 'app', null],
    [' ', 'app', 'bare-key'],
    ['Enter', 'app', 'bare-key'],
    ['/', 'app', null],
    ['Mod-Alt-n', 'app', null],
    ['Mod-Alt-b', 'editor', null],
  ])('%s in %s', (combo, scope, expected) => {
    expect(refusalOf(combo, scope)).toBe(expected);
  });
});

describe('assignShortcut and resetShortcut', () => {
  it('stores only a change from the default', () => {
    expect(assignShortcut({}, 'bold', 'Mod-b')).toEqual({});
    expect(assignShortcut({ bold: 'Mod-Alt-b' }, 'bold', 'Mod-b')).toEqual({});
  });

  it('clears the action it replaces in the same write', () => {
    expect(assignShortcut({}, 'bold', 'Mod-Shift-b', 'blockquote')).toEqual({
      bold: 'Mod-Shift-b',
      blockquote: null,
    });
  });

  it('stores a cleared shortcut as null, and a reset removes the override', () => {
    expect(assignShortcut({}, 'italic', null)).toEqual({ italic: null });
    expect(resetShortcut({ italic: null, bold: 'Mod-Alt-b' }, 'italic')).toEqual({
      bold: 'Mod-Alt-b',
    });
  });
});
