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

export interface ResolvedFamily {
  family: ToolbarFamily;
  collapsed: boolean;
  /** The leaves that are on, in the user's order. Never empty - see `resolveLayout`. */
  items: ToolbarItem[];
}

/**
 * Brings a stored Layout up to date with the registry without losing anything. Still
 * storage-shaped (unknown ids kept), so it is safe to write straight back.
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

  // Nothing stored (absent or the schema's empty array) means never customised: the
  // answer is the whole default arrangement, not a bar rebuilt in registry order.
  const families = reconcileOrder(
    stored?.length ? stored : defaults,
    TOOLBAR_FAMILIES.map((family) => family.id),
    defaultFor
  );

  return families.map((family): ToolbarFamilyPref => {
    const registryFamily = getToolbarFamily(family.id);
    if (!registryFamily) return family;
    const defaultMembers = defaultFor(family.id).members;
    return {
      ...family,
      members: reconcileOrder(
        family.members,
        itemsInFamily(registryFamily.id).map((item) => item.id),
        (id): ToolbarMemberPref =>
          defaultMembers.find((member) => member.id === id) ?? { id, on: true }
      ),
    };
  });
}

/**
 * A family whose every leaf is off is dropped, not rendered empty: expanded it would
 * be a gap, and collapsed a trigger that opens nothing.
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
      const registryItems = itemsInFamily(registryFamily.id);
      const items = family.members
        .filter((member) => member.on)
        .map((member) => registryItems.find((item) => item.id === member.id))
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
