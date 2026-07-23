import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from './deps';
import { insertAttachmentFiles } from './insert';

function stubDeps(over: Partial<AttachmentDeps> = {}): AttachmentDeps {
  const now = new Date().toISOString();
  return {
    getNoteId: vi.fn(async () => 'n1'),
    createAttachment: vi.fn(
      async (noteId: string, file: File, kind) =>
        ({
          id: 'att-1',
          noteId,
          kind,
          mime: file.type,
          blob: file,
          name: file.name,
          createdAt: now,
          updatedAt: now,
        }) as Attachment
    ),
    getAttachment: vi.fn(),
    cloneAttachment: vi.fn(),
    onError: vi.fn(),
    t: (k: string) => k,
    ...over,
  } as unknown as AttachmentDeps;
}

function createEditor() {
  return new Editor({ extensions: [Document, Paragraph, Text], content: '<p></p>' });
}

describe('insertAttachmentFiles - file kind', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('takes any-MIME files for kind "file" and inserts one node each', async () => {
    const deps = stubDeps();
    const insertNode = vi.fn();
    const files = [new File([new Uint8Array(10)], 'doc.pdf', { type: 'application/pdf' })];
    await insertAttachmentFiles(editor, files, 'file', deps, insertNode);
    expect(deps.createAttachment).toHaveBeenCalledWith('n1', files[0], 'file');
    expect(insertNode).toHaveBeenCalledWith('att-1');
  });
});
