import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';
import { createImage } from './Image';

const t = ((key: string) => key) as AttachmentDeps['t'];

function stubDeps(): AttachmentDeps {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn((_noteId, _file, _kind) => {
      throw new Error('not implemented');
    }),
    getAttachment: vi.fn(async () => undefined),
    cloneAttachment: vi.fn(),
    onError: vi.fn(),
    t,
  };
}

function createEditor(deps = stubDeps()) {
  return new Editor({
    extensions: [Document, Paragraph, Text, createImage(() => deps)],
    content: '<p></p>',
  });
}

describe('imageAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses img[data-attachment-id] and re-renders it with no src', () => {
    editor.commands.setContent('<img data-attachment-id="abc">');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('src=');
  });

  it('insertImageAttachment inserts a node carrying the id', () => {
    editor.commands.insertImageAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  // Regression: the node is an atom, so insertContent left a NodeSelection on it;
  // a second insert (via the same focus()-restoring path the picker loop uses)
  // replaced the first instead of appending. Multiple attachments must coexist.
  it('stacks multiple attachments instead of replacing the previous one', () => {
    editor.chain().focus().insertImageAttachment({ attachmentId: 'a1' }).run();
    editor.chain().focus().insertImageAttachment({ attachmentId: 'a2' }).run();
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="a1"');
    expect(html).toContain('data-attachment-id="a2"');
  });

  it('exposes a Pattern A button with the image icon + tooltip', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'imageAttachment');
    const options = ext?.options as {
      button: (c: { editor: Editor; t: AttachmentDeps['t'] }) => {
        componentProps: { tooltip: string };
      };
    };
    const view = options.button({ editor, t });
    expect(view.componentProps.tooltip).toBe('editor.image.tooltip');
  });
});

describe('insertAttachmentFiles (image)', () => {
  function insertImage(editor: Editor, files: FileList | File[], deps: AttachmentDeps) {
    return insertAttachmentFiles(editor, files, 'image', deps, (id) =>
      editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
    );
  }

  it('creates an attachment then inserts a node per valid image', async () => {
    const deps = stubDeps();
    deps.createAttachment = vi.fn(async (_n, file) => ({
      id: `att-${file.name}`,
      noteId: 'note-1',
      kind: 'image' as const,
      mime: file.type,
      blob: file,
      createdAt: '',
      updatedAt: '',
    }));
    const editor = createEditor(deps);
    const png = new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });

    await insertImage(editor, [png], deps);

    expect(deps.getNoteId).toHaveBeenCalledOnce();
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png, 'image');
    expect(editor.getHTML()).toContain('data-attachment-id="att-a.png"');
    editor.destroy();
  });

  it('inserts and keeps a node for every file in a multi-file pick', async () => {
    const deps = stubDeps();
    deps.createAttachment = vi.fn(async (_n, file) => ({
      id: `att-${file.name}`,
      noteId: 'note-1',
      kind: 'image' as const,
      mime: file.type,
      blob: file,
      createdAt: '',
      updatedAt: '',
    }));
    const editor = createEditor(deps);
    const a = new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });
    const b = new File([new Uint8Array(4)], 'b.png', { type: 'image/png' });

    await insertImage(editor, [a, b], deps);

    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="att-a.png"');
    expect(html).toContain('data-attachment-id="att-b.png"');
    editor.destroy();
  });

  it('reports validation failures via onError and inserts nothing', async () => {
    const deps = stubDeps();
    const { AttachmentError } = await import('@/lib/attachments.ts');
    deps.createAttachment = vi.fn(async () => {
      throw new AttachmentError('too-large');
    });
    const editor = createEditor(deps);
    const big = new File([new Uint8Array(4)], 'b.png', { type: 'image/png' });

    await insertImage(editor, [big], deps);

    expect(deps.onError).toHaveBeenCalledWith('too-large');
    expect(editor.getHTML()).not.toContain('data-attachment-id');
    editor.destroy();
  });

  it('reports a generic failure via onError and continues past a non-validation error', async () => {
    const deps = stubDeps();
    deps.createAttachment = vi.fn(async () => {
      throw new Error('boom');
    });
    const editor = createEditor(deps);
    const png = new File([new Uint8Array(4)], 'c.png', { type: 'image/png' });

    await expect(insertImage(editor, [png], deps)).resolves.toBeUndefined();

    expect(deps.onError).toHaveBeenCalledWith('insert-failed');
    editor.destroy();
  });

  it('ignores non-image files', async () => {
    const deps = stubDeps();
    const editor = createEditor(deps);
    const txt = new File(['hi'], 'n.txt', { type: 'text/plain' });
    await insertImage(editor, [txt], deps);
    expect(deps.getNoteId).not.toHaveBeenCalled();
    editor.destroy();
  });
});
