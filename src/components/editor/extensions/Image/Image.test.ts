import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { createImage } from './Image';
import { insertImageAttachmentFiles } from './insert.ts';

vi.mock('@/lib/image-thumbnail.ts', () => ({
  generateImageThumbnail: vi.fn(async () => undefined),
}));

const t = ((key: string) => key) as AttachmentDeps['t'];

function stubDeps(): AttachmentDeps {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn((_noteId, _file, _kind) => {
      throw new Error('not implemented');
    }),
    getAttachment: vi.fn(async () => undefined),
    cloneAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    openExcalidraw: vi.fn(),
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
    vi.mocked(generateImageThumbnail).mockResolvedValue(undefined);
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

describe('insertImageAttachmentFiles', () => {
  function insertImage(editor: Editor, files: FileList | File[], deps: AttachmentDeps) {
    return insertImageAttachmentFiles(editor, files, deps, (id: string) =>
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

  it('stores a generated thumbnail with the full image attachment', async () => {
    const deps = stubDeps();
    const thumbnail = new Blob(['small'], { type: 'image/webp' });
    vi.mocked(generateImageThumbnail).mockResolvedValue(thumbnail);
    deps.createAttachment = vi.fn(async (_noteId, file) => ({
      id: 'att-with-thumbnail',
      noteId: 'note-1',
      kind: 'image' as const,
      mime: file.type,
      blob: file,
      thumbnail,
      createdAt: '',
      updatedAt: '',
    }));
    const editor = createEditor(deps);
    const png = new File([new Uint8Array(4)], 'large.png', { type: 'image/png' });

    await insertImage(editor, [png], deps);

    expect(generateImageThumbnail).toHaveBeenCalledWith(png);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png, 'image', { thumbnail });
    expect(editor.getHTML()).toContain('data-attachment-id="att-with-thumbnail"');
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
