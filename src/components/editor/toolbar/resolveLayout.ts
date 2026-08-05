import { reconcileOrder } from '@/lib/reconcile-order.ts';
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

  // Nothing stored - absent, or the empty array the schema defaults to - means
  // "never customised", and the answer to that is the whole default arrangement,
  // not a bar reconstructed in registry order.
  const families = reconcileOrder(
    stored?.length ? stored : defaults,
    TOOLBAR_FAMILIES.map((family) => family.id),
    defaultFor
  );

  return families.map((family): ToolbarFamilyPref => {
    const registryFamily = getToolbarFamily(family.id);
    if (!registryFamily) return family;
    const defaults = defaultFor(family.id).members;
    return {
      ...family,
      members: reconcileOrder(
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
