import type { Editor } from '@tiptap/core';
import type {
  ButtonContext,
  ButtonView,
  TFunction,
} from '@/components/editor/extensions/button-types';
import type { ToolbarFamily, ToolbarFamilyId, ToolbarItem } from './types';

/**
 * The families, in the order a fresh Layout lays them out. Order here is also
 * the reconciliation anchor: an Item or family absent from a stored blob is
 * inserted at its registry position (decision 8).
 */
export const TOOLBAR_FAMILIES: ToolbarFamily[] = [
  {
    id: 'history',
    labelKey: 'editor.toolbar.family.history',
    reportsState: false,
    icon: 'Undo2',
    collapsible: true,
  },
  {
    id: 'style',
    labelKey: 'editor.toolbar.family.style',
    // Outside a heading the trigger falls back to the paragraph mark, which is
    // the honest answer to "what block am I in".
    reportsState: true,
    icon: 'Pilcrow',
    collapsible: true,
  },
  {
    id: 'format',
    labelKey: 'editor.toolbar.family.format',
    // Bold and italic can both be on at once, so there is no single state to
    // report; a trigger that showed only the first would be lying.
    reportsState: false,
    icon: 'Type',
    collapsible: true,
  },
  {
    id: 'colour',
    labelKey: 'editor.toolbar.family.colour',
    reportsState: false,
    icon: 'Palette',
    collapsible: true,
  },
  {
    id: 'list',
    labelKey: 'editor.toolbar.family.list',
    reportsState: true,
    icon: 'List',
    collapsible: true,
  },
  {
    id: 'block',
    labelKey: 'editor.toolbar.family.block',
    reportsState: true,
    icon: 'Blocks',
    collapsible: true,
  },
  {
    id: 'align',
    labelKey: 'editor.toolbar.family.align',
    reportsState: true,
    icon: 'AlignLeft',
    collapsible: true,
  },
  {
    id: 'media',
    labelKey: 'editor.toolbar.family.media',
    reportsState: false,
    icon: 'Paperclip',
    collapsible: true,
  },
  {
    id: 'font',
    labelKey: 'editor.toolbar.family.font',
    reportsState: false,
    icon: 'CaseSensitive',
    collapsible: true,
  },
  {
    id: 'meta',
    labelKey: 'editor.toolbar.family.meta',
    reportsState: false,
    icon: 'Settings2',
    collapsible: false,
  },
];

/**
 * Every Toolbar Item, grouped by family and ordered as a fresh Layout renders
 * them.
 *
 * The ids are a fresh space rather than the extension names they replace
 * (`Mathematics` -> `math`, `backgroundColor` -> `highlight`, `horizontalRule` ->
 * `divider`, `imageAttachment` -> `image`, ...). The `extension` field keeps the
 * link to TipTap, so the id space stays ours even though the extension names are
 * upstream's - which is the whole point of ADR 0011.
 */
export const TOOLBAR_ITEMS: ToolbarItem[] = [
  // history
  {
    id: 'undo',
    family: 'history',
    extension: 'undoRedo',
    buttonIndex: 0,
    icon: 'Undo2',
    labelKey: 'editor.undo',
  },
  {
    id: 'redo',
    family: 'history',
    extension: 'undoRedo',
    buttonIndex: 1,
    icon: 'Redo2',
    labelKey: 'editor.redo',
  },
  // style
  {
    id: 'h1',
    family: 'style',
    extension: 'heading',
    buttonIndex: 0,
    icon: 'Heading1',
    labelKey: 'editor.slash.heading1',
  },
  {
    id: 'h2',
    family: 'style',
    extension: 'heading',
    buttonIndex: 1,
    icon: 'Heading2',
    labelKey: 'editor.slash.heading2',
  },
  {
    id: 'h3',
    family: 'style',
    extension: 'heading',
    buttonIndex: 2,
    icon: 'Heading3',
    labelKey: 'editor.slash.heading3',
  },
  // format
  {
    id: 'bold',
    family: 'format',
    extension: 'bold',
    icon: 'Bold',
    labelKey: 'editor.bold.tooltip',
  },
  {
    id: 'italic',
    family: 'format',
    extension: 'italic',
    icon: 'Italic',
    labelKey: 'editor.italic.tooltip',
  },
  {
    id: 'underline',
    family: 'format',
    extension: 'underline',
    icon: 'Underline',
    labelKey: 'editor.underline.tooltip',
  },
  {
    id: 'strike',
    family: 'format',
    extension: 'strike',
    icon: 'Strikethrough',
    labelKey: 'editor.strike.tooltip',
  },
  {
    id: 'code',
    family: 'format',
    extension: 'code',
    icon: 'Code',
    labelKey: 'editor.code.tooltip',
  },
  {
    id: 'link',
    family: 'format',
    extension: 'link',
    icon: 'Link2',
    labelKey: 'editor.link.tooltip',
  },
  {
    id: 'clear',
    family: 'format',
    extension: 'clear',
    icon: 'RemoveFormatting',
    labelKey: 'editor.clearFormatting.tooltip',
  },
  // colour
  {
    id: 'text-color',
    family: 'colour',
    extension: 'color',
    icon: 'Baseline',
    labelKey: 'editor.textColor.tooltip',
  },
  {
    id: 'highlight',
    family: 'colour',
    extension: 'backgroundColor',
    icon: 'Highlighter',
    labelKey: 'editor.highlight.tooltip',
  },
  // list
  {
    id: 'bullet-list',
    family: 'list',
    extension: 'bulletList',
    icon: 'List',
    labelKey: 'editor.bulletList.tooltip',
  },
  {
    id: 'ordered-list',
    family: 'list',
    extension: 'orderedList',
    icon: 'ListOrdered',
    labelKey: 'editor.orderedList.tooltip',
  },
  {
    id: 'task-list',
    family: 'list',
    extension: 'taskList',
    icon: 'ListTodo',
    labelKey: 'editor.taskList.tooltip',
  },
  // block
  {
    id: 'blockquote',
    family: 'block',
    extension: 'blockquote',
    icon: 'Quote',
    labelKey: 'editor.blockquote.tooltip',
  },
  {
    id: 'code-block',
    family: 'block',
    extension: 'codeBlock',
    icon: 'Code2',
    labelKey: 'editor.codeBlock.tooltip',
  },
  {
    id: 'divider',
    family: 'block',
    extension: 'horizontalRule',
    icon: 'Minus',
    labelKey: 'editor.horizontalRule.tooltip',
  },
  {
    id: 'math',
    family: 'block',
    extension: 'Mathematics',
    icon: 'Latex',
    labelKey: 'editor.math.tooltip',
  },
  // align
  {
    id: 'align-left',
    family: 'align',
    extension: 'textAlign',
    buttonIndex: 0,
    icon: 'AlignLeft',
    labelKey: 'editor.textAlign.left',
  },
  {
    id: 'align-center',
    family: 'align',
    extension: 'textAlign',
    buttonIndex: 1,
    icon: 'AlignCenter',
    labelKey: 'editor.textAlign.center',
  },
  {
    id: 'align-right',
    family: 'align',
    extension: 'textAlign',
    buttonIndex: 2,
    icon: 'AlignRight',
    labelKey: 'editor.textAlign.right',
  },
  // media
  {
    id: 'image',
    family: 'media',
    extension: 'imageAttachment',
    icon: 'ImagePlus',
    labelKey: 'editor.image.tooltip',
  },
  {
    id: 'audio',
    family: 'media',
    extension: 'audioAttachment',
    icon: 'Mic',
    labelKey: 'editor.audio.tooltip',
  },
  {
    id: 'video',
    family: 'media',
    extension: 'videoAttachment',
    icon: 'FileVideo',
    labelKey: 'editor.video.tooltip',
  },
  {
    id: 'file',
    family: 'media',
    extension: 'fileAttachment',
    icon: 'Paperclip',
    labelKey: 'editor.file.tooltip',
  },
  {
    id: 'drawing',
    family: 'media',
    extension: 'excalidrawAttachment',
    icon: 'PenTool',
    labelKey: 'editor.excalidraw.tooltip',
  },
  // font
  {
    id: 'font-family',
    family: 'font',
    extension: 'fontFamily',
    icon: 'Type',
    labelKey: 'editor.fontFamily.tooltip',
  },
  {
    id: 'font-size',
    family: 'font',
    extension: 'fontSize',
    icon: 'CaseSensitive',
    labelKey: 'editor.fontSize.tooltip',
  },
  // meta - the one Item with no extension behind it: it opens the settings sheet.
  { id: 'customize', family: 'meta', icon: 'Settings2', labelKey: 'editor.toolbar.customize' },
];

/**
 * The one Item the app owns rather than an extension: it opens the customisation
 * sheet instead of editing the note, so it resolves to no button view and the
 * bar draws it itself.
 */
export const CUSTOMIZE_ITEM_ID = 'customize';

const ITEMS_BY_ID = new Map(TOOLBAR_ITEMS.map((item) => [item.id, item]));
const FAMILIES_BY_ID = new Map(TOOLBAR_FAMILIES.map((family) => [family.id, family]));

export function getToolbarItem(id: string): ToolbarItem | undefined {
  return ITEMS_BY_ID.get(id);
}

export function getToolbarFamily(id: string): ToolbarFamily | undefined {
  return FAMILIES_BY_ID.get(id as ToolbarFamilyId);
}

/** The family's Items in registry order. */
export function itemsInFamily(familyId: ToolbarFamilyId): ToolbarItem[] {
  return TOOLBAR_ITEMS.filter((item) => item.family === familyId);
}

/**
 * Whether this editor can draw the Item at all.
 *
 * The bar drops what it cannot draw *before* anything downstream cares about
 * position - an unmounted extension must not leave a gap, a trigger that opens
 * an empty popover, or (worse) become the pinned first family.
 */
export function canRenderItem(
  item: ToolbarItem,
  context: { editor: Editor; t: TFunction }
): boolean {
  return item.id === CUSTOMIZE_ITEM_ID || resolveItemButton(item, context) !== undefined;
}

/**
 * Resolve an Item to the live button view its extension contributes.
 *
 * Returns `undefined` for an Item whose extension is not mounted (or exposes no
 * `button`), and for `customize`, which the toolbar renders itself. Callers skip
 * what they cannot resolve, so an unregistered extension is a missing button,
 * never a crash.
 */
export function resolveItemButton(
  item: ToolbarItem,
  { editor, t }: { editor: Editor; t: TFunction }
): ButtonView | undefined {
  if (!item.extension) return undefined;
  const extension = editor.extensionManager.extensions.find((e) => e.name === item.extension);
  const factory = extension?.options?.button as
    | ((context: ButtonContext) => ButtonView | ButtonView[])
    | undefined;
  if (!factory) return undefined;
  const result = factory({ editor, t });
  const views = Array.isArray(result) ? result : [result];
  return views[item.buttonIndex ?? 0];
}
