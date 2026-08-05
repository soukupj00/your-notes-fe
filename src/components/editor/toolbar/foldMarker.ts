import { getToolbarFamily } from './registry';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';

/**
 * How many buttons a 360px phone shows before the compact bar starts scrolling.
 *
 * Arithmetic rather than a guess: the editor dialog is full-bleed on a phone
 * with `p-6` (48px of padding), leaving 312px; a toolbar button is `min-w-9`
 * (36px) with a `gap-1` (4px) between, so `n` of them need `40n - 4` px. Seven
 * fit at 308px and an eighth would need 348px.
 *
 * It is a marker, not a limit: going past it is allowed, and the number exists
 * so the user configures against the real constraint instead of discovering it
 * on their phone.
 */
export const COMPACT_FOLD_SLOTS = 7;

/**
 * The number of bar slots a family occupies: one for a collapsed trigger,
 * otherwise one per leaf that is on.
 *
 * A family that is off, or whose every leaf is off, takes none - `resolveLayout`
 * drops both rather than drawing an empty box, so counting them would push the
 * fold marker down past buttons that do not exist.
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
 *
 * Zero is a real answer: a first family with eight leaves expanded already fills
 * the bar, and a marker above every row is the honest way to say so.
 */
export function foldIndex(layout: ToolbarLayout): number | null {
  let slots = 0;
  for (const [index, family] of layout.entries()) {
    slots += familySlots(family);
    if (slots > COMPACT_FOLD_SLOTS) return index;
  }
  return null;
}
