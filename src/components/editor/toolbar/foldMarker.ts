import { getToolbarFamily } from './registry';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';

/**
 * How many buttons a 360px phone shows before the compact bar starts scrolling.
 *
 * Arithmetic rather than a guess: the editor dialog is full-bleed on a phone
 * with `p-6` (48px of padding), leaving 312px; a toolbar button is 44px wide,
 * because DESIGN.md's 44px Touch Rule raises every `[data-slot="button"]` to
 * that floor under `@media (pointer: coarse)`, and they sit `gap-1` (4px)
 * apart - so `n` of them need `48n - 4` px. Six fit at 284px and a seventh
 * would need 332px. A collapsed family's trigger is slightly wider still
 * (46px: it carries a chevron beside its icon), which six of reach 296px, so
 * six holds for both kinds of slot.
 *
 * This read 7 until the touch rule landed, on the button's *mouse* width of
 * `min-w-9` (36px). That number was measurably wrong on the device it named:
 * the shipped phone default overflowed its own bar by 24px while the settings
 * screen reported it as fitting.
 *
 * It is a marker, not a limit: going past it is allowed, and the number exists
 * so the user configures against the real constraint instead of discovering it
 * on their phone.
 */
export const COMPACT_FOLD_SLOTS = 6;

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
