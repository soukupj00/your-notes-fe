import { Archive, Lightbulb, type LucideIcon, Settings, Tag, Trash2 } from 'lucide-react';

/**
 * The destinations in the nav shell, in display order. Shared by the desktop
 * sidebar and the mobile drawer so the two can never drift apart.
 *
 * These import Lucide directly rather than going through
 * `components/icons/icons.ts` - that registry exists so TipTap extension button
 * configs can name an icon with a string, which does not apply here.
 */
export const NAV_ITEMS: { to: string; icon: LucideIcon; labelKey: string }[] = [
  { to: '/', icon: Lightbulb, labelKey: 'nav.notes' },
  // "Edit labels", not "Labels" - the sidebar also lists the labels themselves
  // further down, and two nav entries reading "Labels" would be ambiguous.
  { to: '/settings/labels', icon: Tag, labelKey: 'nav.editLabels' },
  { to: '/archive', icon: Archive, labelKey: 'nav.archive' },
  { to: '/trash', icon: Trash2, labelKey: 'nav.trash' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];
