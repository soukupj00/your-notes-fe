import { moveById } from '@/lib/move-by-id.ts';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';

export function moveFamily(layout: ToolbarLayout, activeId: string, overId: string): ToolbarLayout {
  return moveById(layout, activeId, overId);
}

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
 * Every edit here keeps the Layout storage-shaped, unknown ids and all, because
 * Settings writes it straight back (ADR 0011, decision 8).
 */
export function updateFamily(
  layout: ToolbarLayout,
  familyId: string,
  patch: Partial<Pick<ToolbarFamilyPref, 'on' | 'collapsed'>>
): ToolbarLayout {
  return mapFamily(layout, familyId, (family) => ({ ...family, ...patch }));
}

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
