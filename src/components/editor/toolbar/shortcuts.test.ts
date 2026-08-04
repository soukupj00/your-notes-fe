import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '@/components/editor/extensions/attachments/deps';
import { buildEditorExtensions } from '@/components/editor/extensions/build';
import { resolveItemButton, TOOLBAR_ITEMS } from './registry';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

const t = (key: string) => key;
const deps = { getAttachment: vi.fn(), t } as unknown as AttachmentDeps;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
});

function createEditor(content = '<p>hello world</p>') {
  let editor: Editor | null = null;
  editor = new Editor({
    extensions: buildEditorExtensions({ getDeps: () => deps, getEditor: () => editor, t }),
    content,
  });
  editors.push(editor);
  return editor;
}

/**
 * Modifier order is not meaningful - TipTap writes `Shift-Mod-z` where the
 * button says `Mod+Shift+Z` - so compare the parts, not the spelling.
 */
function normalise(combination: string): string {
  return combination.toLowerCase().split('-').sort().join('-');
}

/** Every key combination the extension manager actually has a handler for. */
function boundKeys(editor: Editor): Set<string> {
  const keys = new Set<string>();
  for (const extension of editor.extensionManager.extensions) {
    // Loosely typed on purpose: `config` is a union of extension/node/mark
    // shapes whose `this` types disagree, and this only needs the key names.
    const add = extension.config.addKeyboardShortcuts as
      | ((this: unknown) => Record<string, unknown>)
      | undefined;
    if (typeof add !== 'function') continue;
    // The shortcut factory only reads `editor`, `options` and `storage`; the
    // rest of the real `this` is scaffolding this test does not need.
    const context = {
      name: extension.name,
      options: extension.options,
      storage: extension.storage,
      editor,
    };
    for (const key of Object.keys(add.call(context))) keys.add(normalise(key));
  }
  return keys;
}

describe('toolbar keyboard shortcuts', () => {
  /**
   * A shortcut shown in a tooltip and bound to nothing is worse than no
   * shortcut: it teaches the user a key that does not work. `Clear` shipped
   * exactly that (`Mod+\`), which is what this test exists to stop.
   */
  it('binds every shortcut the toolbar advertises', () => {
    const editor = createEditor();
    const bound = boundKeys(editor);

    const unbound: string[] = [];
    for (const item of TOOLBAR_ITEMS) {
      const keys = resolveItemButton(item, { editor, t })?.componentProps.shortcutKeys;
      if (!keys?.length) continue;
      // `['Mod','Shift','M']` is TipTap's `Mod-Shift-m`.
      const combination = normalise(keys.join('-'));
      if (!bound.has(combination)) unbound.push(`${item.id}: ${combination}`);
    }

    expect(unbound).toEqual([]);
  });

  it('clears formatting on Mod+Backslash', () => {
    const editor = createEditor('<p><strong>bold</strong></p>');
    editor.commands.selectAll();
    expect(editor.isActive('bold')).toBe(true);

    editor.view.someProp('handleKeyDown', (handler) =>
      handler(editor.view, new KeyboardEvent('keydown', { key: '\\', ctrlKey: true }))
    );

    expect(editor.isActive('bold')).toBe(false);
  });

  it('toggles the default highlight on Mod+Shift+H, and off again', () => {
    const editor = createEditor();
    editor.commands.selectAll();

    const press = () =>
      editor.view.someProp('handleKeyDown', (handler) =>
        handler(
          editor.view,
          new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, shiftKey: true })
        )
      );

    press();
    expect(editor.getHTML()).toContain('background-color');
    press();
    expect(editor.getHTML()).not.toContain('background-color');
  });

  it('falls back to a prompt for Mod+K when no link button is mounted', () => {
    // The whole `format` family can be collapsed, in which case the popover
    // lives inside a closed menu and nothing is listening.
    const editor = createEditor();
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');
    editor.commands.selectAll();

    editor.view.someProp('handleKeyDown', (handler) =>
      handler(editor.view, new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    );

    expect(prompt).toHaveBeenCalled();
    expect(editor.getHTML()).toContain('href="https://example.com"');
  });

  it('prefers the mounted link button over the prompt', () => {
    const editor = createEditor();
    const prompt = vi.spyOn(window, 'prompt');
    let opened = false;
    editor.storage.link.prompt.registerButton(() => {
      opened = true;
    });

    editor.view.someProp('handleKeyDown', (handler) =>
      handler(editor.view, new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    );

    expect(opened).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });
});
