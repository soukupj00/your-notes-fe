import { Editor, getExtensionField } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '@/components/editor/extensions/attachments/deps';
import { buildEditorExtensions } from '@/components/editor/extensions/build';
import { EDITOR_ACTIONS } from '@/components/editor/extensions/Shortcuts/actions';
import { resolveShortcuts, SHORTCUTS, type ShortcutBindings } from '@/lib/shortcuts.ts';

vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));
// Windows, where Ctrl+Alt is also AltGr: every case below must hold there too.
vi.mock('@/lib/shortcut-keys.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/shortcut-keys.ts')>()),
  IS_WINDOWS: true,
}));

const t = (key: string) => key;
const deps = { getAttachment: vi.fn(), t } as unknown as AttachmentDeps;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
});

function createEditor(
  content = '<p>hello world</p>',
  getShortcuts: () => ShortcutBindings = () => resolveShortcuts({})
) {
  let editor: Editor | null = null;
  editor = new Editor({
    extensions: buildEditorExtensions({
      getDeps: () => deps,
      getEditor: () => editor,
      getShortcuts,
      t,
    }),
    content,
  });
  editors.push(editor);
  return editor;
}

/** A real keydown through the editor's handlers; jsdom leaves `keyCode` at 0. */
function press(editor: Editor, init: KeyboardEventInit & { keyCode: number }) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'keyCode', { value: init.keyCode });
  editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event));
}

const ctrl = (key: string, keyCode: number, extra: KeyboardEventInit = {}) => ({
  key,
  keyCode,
  ctrlKey: true,
  ...extra,
});

/** Modifier order is not meaningful - TipTap writes `Shift-Mod-z` - so compare the parts. */
function normalise(combination: string): string {
  return combination.toLowerCase().split('-').sort().join('-');
}

/** Every key the extensions' own keymaps bind with a command modifier held. */
function boundCommandKeys(editor: Editor): string[] {
  const keys = new Set<string>();
  for (const extension of editor.extensionManager.extensions) {
    const add = getExtensionField<(() => Record<string, unknown>) | undefined>(
      extension,
      'addKeyboardShortcuts',
      { name: extension.name, options: extension.options, storage: extension.storage, editor }
    );
    for (const key of Object.keys(add?.() ?? {})) {
      if (/(^|-)(Mod|Ctrl|Meta|Alt)-/.test(key)) keys.add(normalise(key));
    }
  }
  return [...keys].sort();
}

describe('editor shortcuts', () => {
  /** A second keymap would fire a key the user moved or cleared. */
  it('the editor binds no command key of its own', () => {
    expect(boundCommandKeys(createEditor())).toEqual(
      ['Mod-Alt-0', 'Mod-Enter', 'Mod-Backspace', 'Mod-Delete', 'Mod-a'].map(normalise).sort()
    );
  });

  it('has an action for every editor shortcut', () => {
    const ids = SHORTCUTS.filter((def) => def.scope === 'editor').map((def) => def.id);
    expect(Object.keys(EDITOR_ACTIONS).sort()).toEqual(ids.sort());
  });

  it.each([
    ['Ctrl+B bolds', ctrl('b', 66), (e: Editor) => e.isActive('bold')],
    [
      'Ctrl+Alt+2 makes an h2',
      ctrl('2', 50, { altKey: true }),
      (e: Editor) => e.isActive('heading', { level: 2 }),
    ],
    [
      'Ctrl+Shift+8 makes a bullet list',
      ctrl('*', 56, { shiftKey: true }),
      (e: Editor) => e.isActive('bulletList'),
    ],
    [
      'Ctrl+Shift+E centres',
      ctrl('E', 69, { shiftKey: true }),
      (e: Editor) => e.isActive({ textAlign: 'center' }),
    ],
  ])('%s', (_label, init, applied) => {
    const editor = createEditor();
    editor.commands.selectAll();

    press(editor, init);

    expect(applied(editor)).toBe(true);
  });

  it('undoes on Ctrl+Z and redoes on Ctrl+Shift+Z, not on Ctrl+Y', () => {
    const editor = createEditor('<p>a</p>');
    editor.chain().focus('end').insertContent('b').run();

    press(editor, ctrl('z', 90));
    expect(editor.getText()).toBe('a');
    press(editor, ctrl('y', 89));
    expect(editor.getText()).toBe('a');
    press(editor, ctrl('Z', 90, { shiftKey: true }));
    expect(editor.getText()).toBe('ab');
  });

  it('a Czech keyboard reaches the same actions', () => {
    const editor = createEditor();
    editor.commands.selectAll();

    press(editor, ctrl('8', 56, { shiftKey: true }));

    expect(editor.isActive('bulletList')).toBe(true);
  });

  it('a changed shortcut fires and the old one does not', () => {
    const bindings = resolveShortcuts({});
    const editor = createEditor(undefined, () => bindings);
    editor.commands.selectAll();
    bindings.bold = 'Mod-Alt-b';

    press(editor, ctrl('b', 66));
    expect(editor.isActive('bold')).toBe(false);
    press(editor, ctrl('b', 66, { altKey: true }));
    expect(editor.isActive('bold')).toBe(true);
  });

  it('a cleared shortcut does nothing', () => {
    const editor = createEditor(undefined, () => ({
      ...resolveShortcuts({}),
      italic: null,
      link: null,
    }));
    const prompt = vi.spyOn(window, 'prompt');
    editor.commands.selectAll();

    press(editor, ctrl('i', 73));
    press(editor, ctrl('k', 75));

    expect(editor.isActive('italic')).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('AltGr typing never fires a shortcut', () => {
    const editor = createEditor();
    editor.commands.selectAll();

    press(editor, ctrl('~', 49, { altKey: true }));

    expect(editor.isActive('heading', { level: 1 })).toBe(false);
  });

  it('clears formatting on Mod+Backslash', () => {
    const editor = createEditor('<p><strong>bold</strong></p>');
    editor.commands.selectAll();
    expect(editor.isActive('bold')).toBe(true);

    press(editor, ctrl('\\', 220));

    expect(editor.isActive('bold')).toBe(false);
  });

  it('toggles the default highlight on Mod+Shift+H, and off again', () => {
    const editor = createEditor();
    editor.commands.selectAll();

    press(editor, ctrl('H', 72, { shiftKey: true }));
    expect(editor.getHTML()).toContain('background-color');
    press(editor, ctrl('H', 72, { shiftKey: true }));
    expect(editor.getHTML()).not.toContain('background-color');
  });

  // The whole `format` family can be collapsed, in which case the popover lives inside a
  // closed menu, and the bubble menu's button is mounted but detached until a link is selected.
  it.each([
    ['no link button is mounted', () => {}],
    [
      'the only link button is off screen',
      (editor: Editor) => editor.storage.link.prompt.registerButton(() => false),
    ],
  ])('falls back to a prompt for Mod+K when %s', (_, mount) => {
    const editor = createEditor();
    mount(editor);
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');
    editor.commands.selectAll();

    press(editor, ctrl('k', 75));

    expect(prompt).toHaveBeenCalled();
    expect(editor.getHTML()).toContain('href="https://example.com"');
  });

  it('prefers the mounted link button over the prompt', () => {
    const editor = createEditor();
    const prompt = vi.spyOn(window, 'prompt');
    let opened = false;
    editor.storage.link.prompt.registerButton(() => {
      opened = true;
      return true;
    });

    press(editor, ctrl('k', 75));

    expect(opened).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });
});
