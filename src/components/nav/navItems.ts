import { Archive, Lightbulb, type LucideIcon, Tag, Trash2 } from 'lucide-react';

// Lucide directly, not `icons/icons.ts`: that registry is for TipTap buttons naming icons.
export const NAV_ITEMS: { to: string; icon: LucideIcon; labelKey: string }[] = [
  { to: '/', icon: Lightbulb, labelKey: 'nav.notes' },
  // "Edit labels", not "Labels" - the sidebar also lists the labels themselves
  // further down, and two nav entries reading "Labels" would be ambiguous.
  { to: '/labels', icon: Tag, labelKey: 'nav.editLabels' },
  { to: '/archive', icon: Archive, labelKey: 'nav.archive' },
  { to: '/trash', icon: Trash2, labelKey: 'nav.trash' },
];
