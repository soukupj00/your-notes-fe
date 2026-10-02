import type { IconName } from '@/components/icons';

/** Named after the window, not the device: a narrow desktop window is `compact` too (ADR 0011). */
export type WidthClass = 'compact' | 'wide';

/** The ten groups every Toolbar Item belongs to. A leaf cannot leave its family. */
export type ToolbarFamilyId =
  | 'history'
  | 'style'
  | 'format'
  | 'colour'
  | 'list'
  | 'block'
  | 'align'
  | 'media'
  | 'font'
  | 'meta';

/**
 * One leaf of the toolbar. Behaviour stays with the extension (Pattern A, ADR 0004);
 * `extension` + `buttonIndex` pick which of its buttons this is, as Heading yields three.
 */
export interface ToolbarItem {
  /** Persisted user data once shipped, so a rename is a migration (ADR 0011). */
  id: string;
  family: ToolbarFamilyId;
  /** Absent only for the app-owned `customize`, which has no editing behaviour. */
  extension?: string;
  buttonIndex?: number;
  /** For Settings, which has no live editor; the live bar uses the button's own icon. */
  icon: IconName;
  /**
   * The action's name in Settings and the slash menu (ADR 0011, decision 13).
   * A name, not a tooltip: "Image", not "Insert image".
   */
  labelKey: string;
  /**
   * A deliberate copy of the extension's `shortcutKeys` for Settings, pinned to the
   * real button by `shortcuts.test.ts`. Why a copy: editor/CLAUDE.md.
   */
  shortcut?: string[];
}

/** A group of Items, expanded onto the bar or collapsed behind one trigger. */
export interface ToolbarFamily {
  id: ToolbarFamilyId;
  labelKey: string;
  /**
   * A collapsed trigger shows the active leaf's icon, so collapsing loses less
   * (decision 6). Action-only families keep the static `icon`.
   */
  reportsState: boolean;
  /** Trigger icon when the family reports no state, and its settings-row icon. */
  icon: IconName;
  /** `meta` is a single button; a menu wrapped around one gear is not a menu. */
  collapsible: boolean;
}

/** Stored visibility of one leaf. Array position is its order. */
export interface ToolbarMemberPref {
  id: string;
  on: boolean;
}

/** Stored state of one family. Array position is its order on the bar. */
export interface ToolbarFamilyPref {
  id: string;
  /** The whole family is present on the bar. */
  on: boolean;
  /** One trigger with a popover, rather than its leaves loose on the bar. */
  collapsed: boolean;
  members: ToolbarMemberPref[];
}

/**
 * Ids are plain strings, not the registry unions: Items written by a later release
 * must survive a round-trip through this build (decision 8).
 */
export type ToolbarLayout = ToolbarFamilyPref[];
