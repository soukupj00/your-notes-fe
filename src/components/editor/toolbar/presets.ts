import { itemsInFamily, TOOLBAR_FAMILIES } from './registry';
import type { ToolbarFamilyId, ToolbarLayout, WidthClass } from './types';

/** The three stamps offered in the settings editor. Reset re-stamps `balanced`. */
export type ToolbarPresetId = 'minimal' | 'balanced' | 'everything';

/**
 * How one family appears in a preset. `leaves` omitted means every leaf is on;
 * a family absent from the spec is off entirely.
 */
interface FamilySpec {
  family: ToolbarFamilyId;
  collapsed?: boolean;
  leaves?: string[];
}

/**
 * Expand a preset spec into a full Layout.
 *
 * Every family and leaf in the registry appears in the result, on or off, so a
 * stamped Layout is complete and the settings editor can show the user what they
 * turned off as readily as what they turned on. Families named in the spec come
 * first in the order the spec lists them; the rest follow in registry order,
 * switched off.
 */
export function buildLayout(spec: FamilySpec[]): ToolbarLayout {
  const listed = new Set(spec.map((entry) => entry.family));
  const rest = TOOLBAR_FAMILIES.filter((family) => !listed.has(family.id)).map(
    (family): FamilySpec => ({ family: family.id, leaves: [] })
  );

  return [...spec, ...rest].map((entry) => ({
    id: entry.family,
    on: listed.has(entry.family),
    collapsed: entry.collapsed ?? false,
    members: itemsInFamily(entry.family).map((item) => ({
      id: item.id,
      on: entry.leaves ? entry.leaves.includes(item.id) : true,
    })),
  }));
}

/**
 * Compact / Balanced - the phone default: undo and redo as two real buttons at
 * the left edge, then five collapsed families.
 *
 * `history` is expanded rather than collapsed because a phone has no Ctrl+Z, so
 * undo is the one control that may not cost a tap to *reach* before it costs a
 * tap to use - and being first, it is also the pinned family, so it stays put
 * while the rest of the bar scrolls under it. Redo comes with it: they are one
 * gesture pair, and a menu holding two buttons is a menu for the sake of one.
 *
 * `meta` (the gear) is off here. It is a door to a settings screen, not an
 * editing control, and on the one bar where slots are scarce it was spending a
 * slot to duplicate a route `/settings` already offers. Switching it back on is
 * one toggle in that same screen.
 *
 * That leaves six slots, which is exactly what a 360px phone fits
 * (`COMPACT_FOLD_SLOTS`), so `colour`, `block`, `align` and `font` are off
 * rather than collapsed. `colour` is the one that had to give: at one slot it
 * would put the bar past the fold on day one, and text colour and highlight are
 * the most decorative of the set. All four stay reachable through the slash
 * menu, a keyboard shortcut, or by being switched on.
 */
const COMPACT_BALANCED: FamilySpec[] = [
  { family: 'history' },
  { family: 'style', collapsed: true },
  { family: 'format', collapsed: true },
  { family: 'list', collapsed: true },
  { family: 'media', collapsed: true },
];

const COMPACT_MINIMAL: FamilySpec[] = [
  { family: 'style', collapsed: true },
  { family: 'format', leaves: ['bold'] },
  { family: 'list', collapsed: true },
  { family: 'media', collapsed: true },
  { family: 'meta' },
];

/**
 * Wide / Balanced - roughly today's desktop bar plus undo/redo, with alignment
 * and the two font selects folded into menus.
 */
const WIDE_BALANCED: FamilySpec[] = [
  { family: 'history' },
  { family: 'style' },
  { family: 'format' },
  { family: 'colour' },
  { family: 'list' },
  { family: 'block' },
  { family: 'media' },
  { family: 'align', collapsed: true },
  { family: 'font', collapsed: true },
  { family: 'meta' },
];

const WIDE_MINIMAL: FamilySpec[] = [
  { family: 'history' },
  { family: 'style' },
  { family: 'format', leaves: ['bold', 'italic', 'underline'] },
  { family: 'list' },
  { family: 'media', collapsed: true },
  { family: 'meta' },
];

/** Every family on and expanded. On Compact that is a long horizontal scroll,
 *  which is allowed - the fold marker is what tells the user. */
const EVERYTHING: FamilySpec[] = TOOLBAR_FAMILIES.map((family) => ({ family: family.id }));

const SPECS: Record<WidthClass, Record<ToolbarPresetId, FamilySpec[]>> = {
  compact: { minimal: COMPACT_MINIMAL, balanced: COMPACT_BALANCED, everything: EVERYTHING },
  wide: { minimal: WIDE_MINIMAL, balanced: WIDE_BALANCED, everything: EVERYTHING },
};

/** Stamp a preset into a Width Class. Presets are a stamp, not a mode: nothing
 *  remembers which one produced a Layout (decision 9). */
export function toolbarPreset(preset: ToolbarPresetId, widthClass: WidthClass): ToolbarLayout {
  return buildLayout(SPECS[widthClass][preset]);
}

/** The out-of-the-box arrangement for a user who has never customised anything. */
export function defaultToolbarLayout(widthClass: WidthClass): ToolbarLayout {
  return toolbarPreset('balanced', widthClass);
}
