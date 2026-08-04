import { defaultToolbarLayout } from './presets';
import { getToolbarFamily, itemsInFamily, TOOLBAR_FAMILIES } from './registry';
import type {
  ToolbarFamily,
  ToolbarFamilyPref,
  ToolbarItem,
  ToolbarLayout,
  ToolbarMemberPref,
  WidthClass,
} from './types';

/** One family as the bar should draw it: either its leaves loose, or one trigger. */
export interface ResolvedFamily {
  family: ToolbarFamily;
  collapsed: boolean;
  /** The leaves that are on, in the user's order. Never empty - see `resolveLayout`. */
  items: ToolbarItem[];
}

/**
 * Insert the registry entries a stored list has never heard of, at their registry
 * position, and leave everything else alone.
 *
 * This is decision 8 in one function, and it cuts both ways:
 *
 * - A registry id missing from the blob is **new**, not hidden, so a button
 *   shipped next release appears for a user who customised their bar last year.
 *   Anything else would mean new work is invisible to exactly the users who care
 *   most about the toolbar.
 * - A blob id missing from the registry is **kept**, so a temporarily
 *   unregistered extension (a lazy chunk that failed, a build that dropped one)
 *   cannot quietly erase an arrangement the user built by hand.
 *
 * Missing entries are processed in registry order, so a run of several new ones
 * lands in the right order relative to each other too.
 */
function reconcileList<T extends { id: string }>(
  stored: T[],
  registryIds: string[],
  createDefault: (id: string) => T
): T[] {
  const result = [...stored];

  registryIds.forEach((id, registryIndex) => {
    if (result.some((entry) => entry.id === id)) return;
    // Land it before the nearest registry sibling that follows it and is already
    // present; with none, the tail is as close to "its position" as we can get.
    const following = registryIds.slice(registryIndex + 1);
    const anchor = result.findIndex((entry) => following.includes(entry.id));
    result.splice(anchor === -1 ? result.length : anchor, 0, createDefault(id));
  });

  return result;
}

/**
 * Bring a stored Layout up to date with the registry without losing anything.
 *
 * The result is still storage-shaped (it keeps ids this build does not know) so
 * it is safe to write straight back; `resolveLayout` is what turns it into
 * something renderable.
 */
export function reconcileLayout(
  stored: ToolbarLayout | undefined,
  widthClass: WidthClass
): ToolbarLayout {
  const defaults = defaultToolbarLayout(widthClass);
  const defaultFor = (id: string) =>
    defaults.find((family) => family.id === id) ?? {
      id,
      on: false,
      collapsed: false,
      members: [],
    };

  // No stored Layout at all is not the same as an empty one: it means "never
  // customised", and the answer to that is the whole default, not a bare bar.
  const families = reconcileList(
    stored ?? defaults,
    TOOLBAR_FAMILIES.map((family) => family.id),
    defaultFor
  );

  return families.map((family): ToolbarFamilyPref => {
    const registryFamily = getToolbarFamily(family.id);
    if (!registryFamily) return family;
    const defaults = defaultFor(family.id).members;
    return {
      ...family,
      members: reconcileList(
        family.members,
        itemsInFamily(registryFamily.id).map((item) => item.id),
        (id): ToolbarMemberPref => defaults.find((member) => member.id === id) ?? { id, on: true }
      ),
    };
  });
}

/**
 * The bar's render list: families that are on and have at least one leaf on, in
 * the user's order, each carrying the leaves it should draw.
 *
 * A family whose every leaf is off is dropped rather than rendered empty - an
 * expanded one would be a gap, and a collapsed one a trigger that opens nothing.
 */
export function resolveLayout(
  stored: ToolbarLayout | undefined,
  widthClass: WidthClass
): ResolvedFamily[] {
  return reconcileLayout(stored, widthClass)
    .filter((family) => family.on)
    .flatMap((family): ResolvedFamily[] => {
      const registryFamily = getToolbarFamily(family.id);
      if (!registryFamily) return []; // stored, preserved, but nothing to draw
      const items = family.members
        .filter((member) => member.on)
        .map((member) => itemsInFamily(registryFamily.id).find((item) => item.id === member.id))
        .filter((item): item is ToolbarItem => item !== undefined);
      if (items.length === 0) return [];
      return [
        {
          family: registryFamily,
          collapsed: family.collapsed && registryFamily.collapsible,
          items,
        },
      ];
    });
}
