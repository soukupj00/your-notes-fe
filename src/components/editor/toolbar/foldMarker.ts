import { getToolbarFamily } from './registry';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';

/**
 * Buttons a 360px phone shows before the compact bar scrolls, at the 44px Touch Rule's
 * width. A marker, not a limit. The arithmetic: editor/CLAUDE.md (the compact default).
 */
export const COMPACT_FOLD_SLOTS = 6;

/**
 * One slot for a collapsed trigger, else one per leaf that is on. An off or empty
 * family takes none, because `resolveLayout` draws nothing for it.
 */
export function familySlots(family: ToolbarFamilyPref): number {
  if (!family.on) return 0;
  const on = family.members.filter((member) => member.on).length;
  if (on === 0) return 0;
  // A family the registry does not know is not drawn either, but it is still
  // stored, so it is counted as nothing rather than dropped from the list.
  const registryFamily = getToolbarFamily(family.id);
  if (!registryFamily) return 0;
  return family.collapsed && registryFamily.collapsible ? 1 : on;
}

/**
 * How many family rows fit above the fold, or `null` when the whole Layout fits.
 * Zero is a real answer: one expanded family can fill the bar alone.
 */
export function foldIndex(layout: ToolbarLayout): number | null {
  let slots = 0;
  for (const [index, family] of layout.entries()) {
    slots += familySlots(family);
    if (slots > COMPACT_FOLD_SLOTS) return index;
  }
  return null;
}
