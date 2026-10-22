import { comboParts, hasCommandModifier } from './key-combo.ts';

/** `app` keys work outside an open note, `editor` keys inside one; a combination is unique per scope. */
export type ShortcutScope = 'app' | 'editor';

export interface ShortcutDef {
  /** An editor shortcut's id is its Toolbar Item's, and stored user data once shipped. */
  id: string;
  scope: ShortcutScope;
  labelKey: string;
  defaultCombo: string;
}

const editor = (id: string, labelKey: string, defaultCombo: string): ShortcutDef => ({
  id,
  scope: 'editor',
  labelKey,
  defaultCombo,
});

/** Every Shortcut, in Settings order: the editor's follow the toolbar registry (ADR 0026). */
export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: 'new-note', scope: 'app', labelKey: 'settings.shortcuts.newNote.label', defaultCombo: 'n' },
  {
    id: 'search',
    scope: 'app',
    labelKey: 'settings.shortcuts.search.label',
    defaultCombo: 'Mod-k',
  },
  editor('undo', 'editor.undo', 'Mod-z'),
  editor('redo', 'editor.redo', 'Mod-Shift-z'),
  editor('h1', 'editor.heading.h1', 'Mod-Alt-1'),
  editor('h2', 'editor.heading.h2', 'Mod-Alt-2'),
  editor('h3', 'editor.heading.h3', 'Mod-Alt-3'),
  editor('bold', 'editor.bold.tooltip', 'Mod-b'),
  editor('italic', 'editor.italic.tooltip', 'Mod-i'),
  editor('underline', 'editor.underline.tooltip', 'Mod-u'),
  editor('strike', 'editor.strike.tooltip', 'Mod-Shift-s'),
  editor('code', 'editor.code.tooltip', 'Mod-e'),
  editor('clear', 'editor.clearFormatting.tooltip', 'Mod-\\'),
  editor('highlight', 'editor.highlight.tooltip', 'Mod-Shift-h'),
  editor('bullet-list', 'editor.bulletList.tooltip', 'Mod-Shift-8'),
  editor('ordered-list', 'editor.orderedList.tooltip', 'Mod-Shift-7'),
  editor('task-list', 'editor.taskList.tooltip', 'Mod-Shift-9'),
  editor('align-left', 'editor.textAlign.left', 'Mod-Shift-l'),
  editor('align-center', 'editor.textAlign.center', 'Mod-Shift-e'),
  editor('align-right', 'editor.textAlign.right', 'Mod-Shift-r'),
  editor('blockquote', 'editor.blockquote.tooltip', 'Mod-Shift-b'),
  editor('code-block', 'editor.codeBlock.tooltip', 'Mod-Alt-c'),
  editor('math', 'editor.math.tooltip', 'Mod-Shift-m'),
  editor('link', 'editor.link.tooltip', 'Mod-k'),
];

const DEFS = new Map(SHORTCUTS.map((def) => [def.id, def]));

/** The Preference: only the user's changes, `null` for a cleared Shortcut. */
export type StoredShortcuts = Record<string, string | null>;

/** Every Shortcut's effective combination, `null` when cleared. */
export type ShortcutBindings = Record<string, string | null>;

const MODIFIERS = new Set(['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift']);

/** Whether a stored value is a combination `comboFromEvent` could have produced. */
function isCombo(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  const parts = comboParts(value);
  return parts.at(-1) !== '' && parts.slice(0, -1).every((part) => MODIFIERS.has(part));
}

/** A stored value that is neither `null` nor a combination is unreadable, so its default applies. */
export function resolveShortcuts(stored: StoredShortcuts): ShortcutBindings {
  return Object.fromEntries(
    SHORTCUTS.map(({ id, defaultCombo }) => {
      const value = stored[id];
      return [id, value === null || isCombo(value) ? value : defaultCombo];
    })
  );
}

export function shortcutFor(
  combo: string,
  scope: ShortcutScope,
  bindings: ShortcutBindings
): string | null {
  return SHORTCUTS.find((def) => def.scope === scope && bindings[def.id] === combo)?.id ?? null;
}

/** The other action in the same scope that already has `combo`. */
export function findConflict(id: string, combo: string, bindings: ShortcutBindings): string | null {
  const scope = DEFS.get(id)?.scope;
  if (!scope) return null;
  const owner = shortcutFor(combo, scope, bindings);
  return owner === id ? null : owner;
}

export type Refusal = 'needs-modifier' | 'bare-key' | 'browser' | 'editor';

/** The page never receives these, or cannot cancel them. */
const BROWSER_COMBOS = new Set([
  'Mod-w',
  'Mod-t',
  'Mod-n',
  'Mod-Shift-n',
  'Mod-Shift-t',
  'Mod-Tab',
  'Mod-Shift-Tab',
  'Mod-q',
]);

/** Typing and editing keys the editor keeps: select all, the clipboard, and TipTap's own. */
const EDITOR_COMBOS = new Set([
  'Mod-a',
  'Mod-c',
  'Mod-v',
  'Mod-x',
  'Mod-Enter',
  'Mod-Backspace',
  'Mod-Delete',
  'Mod-Alt-0',
]);

export function refusalOf(combo: string, scope: ShortcutScope): Refusal | null {
  if (BROWSER_COMBOS.has(combo)) return 'browser';
  const command = hasCommandModifier(combo);
  if (scope === 'editor') {
    if (!command) return 'needs-modifier';
    return EDITOR_COMBOS.has(combo) ? 'editor' : null;
  }
  // A bare key presses the focused button when it is space, and is not a character otherwise.
  return command || ([...combo].length === 1 && combo !== ' ') ? null : 'bare-key';
}

/** Sets one Shortcut, storing nothing when it is back on its default; `replacing` loses its combination. */
export function assignShortcut(
  stored: StoredShortcuts,
  id: string,
  combo: string | null,
  replacing?: string
): StoredShortcuts {
  const next = resetShortcut(stored, id);
  if (combo !== DEFS.get(id)?.defaultCombo) next[id] = combo;
  if (replacing) next[replacing] = null;
  return next;
}

export function resetShortcut(stored: StoredShortcuts, id: string): StoredShortcuts {
  const { [id]: _removed, ...rest } = stored;
  return rest;
}
