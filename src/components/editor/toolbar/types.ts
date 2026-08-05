import type { IconName } from '@/components/icons';

/**
 * Which of the two stored Layouts is in effect. Named after the window, not the
 * device: a narrow desktop window is `compact` too (ADR 0011).
 */
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
 * One leaf of the toolbar: a stable id, how it presents itself in the settings
 * editor, and where its behaviour comes from.
 *
 * Behaviour is *not* here - it stays with the extension (Pattern A, ADR 0004).
 * `extension` + `buttonIndex` say which of that extension's button views this id
 * is, because a single extension can contribute several (Heading yields three,
 * `undoRedo` two).
 */
export interface ToolbarItem {
  /**
   * Stable id. Once shipped this is persisted user data, so a rename is a
   * migration - see ADR 0011.
   */
  id: string;
  family: ToolbarFamilyId;
  /**
   * TipTap extension name owning the Pattern A `button` factory. Absent for the
   * one app-owned Item (`customize`), which has no editing behaviour to own.
   */
  extension?: string;
  /** Index into the extension's button array when it yields more than one. */
  buttonIndex?: number;
  /**
   * Icon for the settings editor, which lists Items without a live editor to
   * resolve their real button views against. The live bar uses the button's own.
   */
  icon: IconName;
  /**
   * i18n key for the action's **name**, shown in the settings editor and in the
   * slash menu (ADR 0011, decision 13).
   *
   * A name, not a tooltip: a toolbar button promises "Insert image", but a list
   * of things you can turn on or insert calls it "Image".
   */
  labelKey: string;
}

/** A group of Items, expanded onto the bar or collapsed behind one trigger. */
export interface ToolbarFamily {
  id: ToolbarFamilyId;
  labelKey: string;
  /**
   * When true, a collapsed trigger shows the icon of whichever leaf is currently
   * active, so collapsing costs less information (decision 6). Action-only
   * families (nothing to be "in") keep the static `icon`.
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
 * One Width Class's arrangement. Ids are plain strings, not the registry unions:
 * a blob written by a later release may name Items this build has never heard of,
 * and those must survive a round-trip rather than be dropped (decision 8).
 */
export type ToolbarLayout = ToolbarFamilyPref[];
