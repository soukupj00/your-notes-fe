import { readFileSync } from 'node:fs';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '@/components/editor/extensions/attachments/deps';
import { buildEditorExtensions } from '@/components/editor/extensions/build';
import { resolveItemButton, TOOLBAR_FAMILIES, TOOLBAR_ITEMS } from './registry';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

/**
 * The identity `t` is what makes this test possible: every string the toolbar
 * asks for comes back as its own key, so a rendered button reports the key it
 * wanted rather than the text it got.
 */
const t = (key: string) => key;
const deps = { getAttachment: vi.fn(), t } as unknown as AttachmentDeps;

const LOCALES = ['en', 'cs'] as const;

const bundles = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(`public/locales/${locale}/translation.json`, 'utf8')),
  ])
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

/**
 * i18next resolves a dotted key by walking the bundle, and treats `key_one` /
 * `key_other` as the plural forms of `key` - so a bare `key` lookup is satisfied
 * by either the exact node or its plural siblings.
 */
function resolves(bundle: Record<string, unknown>, key: string): boolean {
  const path = key.split('.');
  const leaf = path.pop() as string;
  let node: unknown = bundle;
  for (const step of path) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[step];
  }
  if (typeof node !== 'object' || node === null) return false;
  const parent = node as Record<string, unknown>;
  return leaf in parent || `${leaf}_one` in parent || `${leaf}_other` in parent;
}

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
});

function createEditor() {
  let editor: Editor | null = null;
  editor = new Editor({
    extensions: buildEditorExtensions({ getDeps: () => deps, getEditor: () => editor, t }),
    content: '<p>hello world</p>',
  });
  editors.push(editor);
  return editor;
}

/**
 * Every name the toolbar can show must exist in every locale. `editor.heading.level` did
 * not, and the identity `t` every other test stubs cannot see that, so it needs its own gate.
 */
describe('toolbar translations', () => {
  describe.each(LOCALES)('%s', (locale) => {
    const bundle = bundles[locale];

    it('has a name for every Toolbar Item', () => {
      const missing = TOOLBAR_ITEMS.filter((item) => !resolves(bundle, item.labelKey)).map(
        (item) => `${item.id} -> ${item.labelKey}`
      );
      expect(missing).toEqual([]);
    });

    it('has a name for every family', () => {
      const missing = TOOLBAR_FAMILIES.filter((family) => !resolves(bundle, family.labelKey)).map(
        (family) => `${family.id} -> ${family.labelKey}`
      );
      expect(missing).toEqual([]);
    });

    it('has a tooltip for every button the real editor mounts', () => {
      const editor = createEditor();
      const missing: string[] = [];

      for (const item of TOOLBAR_ITEMS) {
        const tooltip = resolveItemButton(item, { editor, t })?.componentProps.tooltip;
        // An Item with no mounted extension (or `customize`, which the bar draws
        // itself) contributes no tooltip - that is `resolveLayout`'s business,
        // not this test's.
        if (typeof tooltip !== 'string' || tooltip === '') continue;
        if (!resolves(bundle, tooltip)) missing.push(`${item.id} -> ${tooltip}`);
      }

      expect(missing).toEqual([]);
    });
  });
});
