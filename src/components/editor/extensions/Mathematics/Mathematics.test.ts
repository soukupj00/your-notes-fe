import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Mathematics, type MathematicsExtensionOptions } from './Mathematics';

const t = (key: string) => key;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, Mathematics],
    content: '<p>formula </p>',
  });
}

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'inlineMath');
  if (!ext) throw new Error('inlineMath not registered');
  return (ext.options as MathematicsExtensionOptions).button({ editor, t }).componentProps;
}

function hasInlineMath(editor: Editor, latex?: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'inlineMath' && (latex === undefined || node.attrs.latex === latex)) {
      found = true;
    }
  });
  return found;
}

describe('Mathematics extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  it('inserts an inlineMath node with the correct latex attribute via command', () => {
    editor.commands.insertInlineMath({ latex: 'a+b' });
    expect(hasInlineMath(editor, 'a+b')).toBe(true);
  });

  it('button componentProps has correct icon, tooltip, and shortcutKeys', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('Sigma');
    expect(props.tooltip).toBe('editor.math.tooltip');
    expect(props.shortcutKeys).toEqual(['Mod', 'Shift', 'M']);
  });

  it('button action inserts an inlineMath node and isActive returns a boolean', () => {
    const props = getButtonProps(editor);
    props.action?.();
    expect(hasInlineMath(editor)).toBe(true);
    expect(typeof props.isActive?.()).toBe('boolean');
  });
});
