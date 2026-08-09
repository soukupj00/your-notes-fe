import { moveById } from '@/lib/move-by-id.ts';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';

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
