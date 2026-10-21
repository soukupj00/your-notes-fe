import { itemsInFamily, TOOLBAR_FAMILIES } from './registry';
import type { ToolbarFamilyId, ToolbarLayout, WidthClass } from './types';

/** The three stamps offered in the settings editor. Reset re-stamps the Width Class's `DEFAULT_PRESET`. */
export type ToolbarPresetId = 'minimal' | 'balanced' | 'everything';

/** `leaves` omitted means every leaf is on; a family absent from the spec is off. */
interface FamilySpec {
  family: ToolbarFamilyId;
  collapsed?: boolean;
  leaves?: string[];
}

/**
 * Every registry family and leaf appears, on or off, so Settings shows what is off as
 * readily as what is on. Spec families come first; the rest follow in registry order, off.
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
 * The phone default: six slots, what a 360px phone fits (`COMPACT_FOLD_SLOTS`).
 * Why these families and not the rest: editor/CLAUDE.md (the compact default).
 */
const COMPACT_BALANCED: FamilySpec[] = [
  { family: 'history' },
  { family: 'format', collapsed: true },
  { family: 'list', collapsed: true },
  { family: 'media', collapsed: true },
  { family: 'style', collapsed: true },
];

/** Undo stays: a phone has no Ctrl+Z, so a bar without it has no way back. */
const COMPACT_MINIMAL: FamilySpec[] = [
  { family: 'history', leaves: ['undo'] },
  { family: 'format', leaves: ['bold'] },
  { family: 'list', collapsed: true },
  { family: 'media', collapsed: true },
  { family: 'meta' },
];

/** `media` stays expanded so Mod+K anchors the link popover to a visible Link button. */
const WIDE_BALANCED: FamilySpec[] = [
  { family: 'history' },
  { family: 'style' },
  { family: 'font', collapsed: true },
  { family: 'format' },
  { family: 'colour', collapsed: true },
  { family: 'list' },
  { family: 'align', collapsed: true },
  { family: 'block', collapsed: true },
  { family: 'media' },
  { family: 'meta' },
];

/** Link stays a visible button for the same Mod+K reason as Wide Balanced: Minimal is the Wide default. */
const WIDE_MINIMAL: FamilySpec[] = [
  { family: 'history' },
  { family: 'style' },
  { family: 'format', leaves: ['bold', 'italic', 'underline'] },
  { family: 'list' },
  { family: 'media', leaves: ['link', 'image'] },
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

/** Desktop starts lean, with the rest a switch away; the phone's Balanced is already its six slots. */
export const DEFAULT_PRESET: Record<WidthClass, ToolbarPresetId> = {
  compact: 'balanced',
  wide: 'minimal',
};

export function defaultToolbarLayout(widthClass: WidthClass): ToolbarLayout {
  return toolbarPreset(DEFAULT_PRESET[widthClass], widthClass);
}
