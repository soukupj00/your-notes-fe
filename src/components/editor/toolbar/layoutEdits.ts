import type { ToolbarFamilyPref, ToolbarLayout } from './types';

/**
 * Move the entry with `activeId` to where `overId` currently sits.
 *
 * This is the one reorder primitive both lists use, and it is deliberately
 * `id`-based rather than index-based: `@dnd-kit` reports a drag as two ids, and
 * translating those to indices at every call site is where an off-by-one lives.
 * An id the list does not hold is a no-op rather than a throw - a drag can end
 * over nothing at all.
 */
function moveById<T extends { id: string }>(list: T[], activeId: string, overId: string): T[] {
  const from = list.findIndex((entry) => entry.id === activeId);
  const to = list.findIndex((entry) => entry.id === overId);
  if (from === -1 || to === -1 || from === to) return list;

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Reorder the families of one Width Class. Array position is bar order. */
export function moveFamily(layout: ToolbarLayout, activeId: string, overId: string): ToolbarLayout {
  return moveById(layout, activeId, overId);
}

/** Reorder the leaves inside one family. Other families are untouched. */
export function moveMember(
  layout: ToolbarLayout,
  familyId: string,
  activeId: string,
  overId: string
): ToolbarLayout {
  return mapFamily(layout, familyId, (family) => ({
    ...family,
    members: moveById(family.members, activeId, overId),
  }));
}

/**
 * Change a family's own state (`on`, `collapsed`).
 *
 * Every edit here returns a *storage-shaped* Layout, unknown ids and all: the
 * settings editor writes its result straight back to the blob, so an id this
 * build cannot render must survive being edited around (ADR 0011, decision 8).
 */
export function updateFamily(
  layout: ToolbarLayout,
  familyId: string,
  patch: Partial<Pick<ToolbarFamilyPref, 'on' | 'collapsed'>>
): ToolbarLayout {
  return mapFamily(layout, familyId, (family) => ({ ...family, ...patch }));
}

/** Turn one leaf on or off inside its family. */
export function setMemberOn(
  layout: ToolbarLayout,
  familyId: string,
  memberId: string,
  on: boolean
): ToolbarLayout {
  return mapFamily(layout, familyId, (family) => ({
    ...family,
    members: family.members.map((member) => (member.id === memberId ? { ...member, on } : member)),
  }));
}

function mapFamily(
  layout: ToolbarLayout,
  familyId: string,
  update: (family: ToolbarFamilyPref) => ToolbarFamilyPref
): ToolbarLayout {
  return layout.map((family) => (family.id === familyId ? update(family) : family));
}
