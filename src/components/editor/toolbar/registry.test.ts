import { readFileSync } from 'node:fs';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '@/components/editor/extensions/attachments/deps';
import { buildEditorExtensions } from '@/components/editor/extensions/build';
import { icons } from '@/components/icons';
import { buildLayout, toolbarPreset } from './presets';
import {
  getToolbarFamily,
  itemsInFamily,
  resolveItemButton,
  TOOLBAR_FAMILIES,
  TOOLBAR_ITEMS,
} from './registry';
import type { WidthClass } from './types';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

const t = (key: string) => key;
const deps = { getAttachment: vi.fn(), t } as unknown as AttachmentDeps;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor() {
  let editor: Editor | null = null;
  editor = new Editor({
    extensions: buildEditorExtensions({
      getDeps: () => deps,
      getEditor: () => editor,
      t,
    }),
  });
  editors.push(editor);
  return editor;
}

// Read from disk rather than importing: the bundles are runtime assets fetched
// by i18next, not modules, and this keeps them out of the app's module graph.
const enTranslation = JSON.parse(
  readFileSync(`${process.cwd()}/public/locales/en/translation.json`, 'utf-8')
);

/** Walk a dotted i18n key into the shipped `en` bundle. */
function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      enTranslation
    );
}

describe('toolbar registry', () => {
  it('has unique item ids and unique family ids', () => {
    const itemIds = TOOLBAR_ITEMS.map((item) => item.id);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    const familyIds = TOOLBAR_FAMILIES.map((family) => family.id);
    expect(new Set(familyIds).size).toBe(familyIds.length);
  });

  it('places every item in a declared family, and gives every family at least one item', () => {
    for (const item of TOOLBAR_ITEMS) {
      expect(getToolbarFamily(item.family), item.id).toBeDefined();
    }
    for (const family of TOOLBAR_FAMILIES) {
      expect(itemsInFamily(family.id).length, family.id).toBeGreaterThan(0);
    }
  });

  it('names a registered icon and a translated label for every item and family', () => {
    for (const entry of [...TOOLBAR_ITEMS, ...TOOLBAR_FAMILIES]) {
      expect(icons[entry.icon], entry.id).toBeDefined();
      expect(typeof lookup(entry.labelKey), entry.labelKey).toBe('string');
    }
  });

  // The regression this guards is the `videoAttachment` one: a name the toolbar
  // asked for that nothing registered simply produced no button, silently.
  it('resolves every item to a button contributed by a mounted extension', () => {
    const editor = createEditor();
    for (const item of TOOLBAR_ITEMS) {
      if (!item.extension) continue; // `customize` is app-owned, not an extension
      const view = resolveItemButton(item, { editor, t });
      expect(view, item.id).toBeDefined();
      // A component is a function or a forwardRef object; either is renderable.
      expect(view?.component, item.id).toBeTruthy();
      expect(view?.componentProps, item.id).toBeTruthy();
    }
  });

  it('resolves the right button when one extension contributes several', () => {
    const editor = createEditor();
    const icons = ['undo', 'redo', 'h1', 'h2', 'h3'].map((id) => {
      const item = TOOLBAR_ITEMS.find((candidate) => candidate.id === id);
      if (!item) throw new Error(`${id} missing from the registry`);
      return resolveItemButton(item, { editor, t })?.componentProps.icon;
    });
    expect(icons).toEqual(['Undo2', 'Redo2', 'Heading1', 'Heading2', 'Heading3']);
  });

  it('returns undefined rather than throwing for an unmounted extension', () => {
    const editor = createEditor();
    const view = resolveItemButton(
      {
        id: 'ghost',
        family: 'format',
        extension: 'nobodyRegistersThis',
        icon: 'Bold',
        labelKey: 'editor.bold.tooltip',
      },
      { editor, t }
    );
    expect(view).toBeUndefined();
  });
});

describe('toolbar presets', () => {
  const widths: WidthClass[] = ['compact', 'wide'];
  const presets = ['minimal', 'balanced', 'everything'] as const;

  it('covers every registry family and item, in every preset', () => {
    for (const width of widths) {
      for (const preset of presets) {
        const layout = toolbarPreset(preset, width);
        expect(layout.map((family) => family.id).sort()).toEqual(
          TOOLBAR_FAMILIES.map((family) => family.id).sort()
        );
        for (const family of layout) {
          expect(family.members.map((member) => member.id)).toEqual(
            itemsInFamily(family.id as never).map((item) => item.id)
          );
        }
      }
    }
  });

  it('turns something on in every preset, and everything on in Everything', () => {
    for (const width of widths) {
      for (const preset of presets) {
        const layout = toolbarPreset(preset, width);
        const visible = layout.filter(
          (family) => family.on && family.members.some((member) => member.on)
        );
        expect(visible.length, `${width}/${preset}`).toBeGreaterThan(0);
      }
      const everything = toolbarPreset('everything', width);
      expect(everything.every((family) => family.on && !family.collapsed)).toBe(true);
      expect(everything.every((family) => family.members.every((member) => member.on))).toBe(true);
    }
  });

  it('keeps the customise gear in every preset, so there is always a way back', () => {
    for (const width of widths) {
      for (const preset of presets) {
        const meta = toolbarPreset(preset, width).find((family) => family.id === 'meta');
        expect(meta?.on, `${width}/${preset}`).toBe(true);
        expect(meta?.members).toEqual([{ id: 'customize', on: true }]);
      }
    }
  });

  it('orders listed families first and switches the rest off', () => {
    const layout = buildLayout([{ family: 'list' }, { family: 'format', leaves: ['bold'] }]);
    expect(layout.slice(0, 2).map((family) => family.id)).toEqual(['list', 'format']);
    expect(layout.slice(2).every((family) => !family.on)).toBe(true);
    const format = layout.find((family) => family.id === 'format');
    expect(format?.members.filter((member) => member.on).map((member) => member.id)).toEqual([
      'bold',
    ]);
  });

  it('makes undo reachable on a phone, which is what the old mobile bar could not', () => {
    const compact = toolbarPreset('balanced', 'compact');
    const history = compact.find((family) => family.id === 'history');
    expect(history?.on).toBe(true);
    expect(history?.members.find((member) => member.id === 'undo')?.on).toBe(true);
  });
});
