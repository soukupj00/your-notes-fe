import { type AnyExtension, Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import { ATTACHMENT_KINDS, type AttachmentKind } from '@/models.ts';
import { createAudio } from '../Audio/Audio';
import { AudioRecordButton } from '../Audio/AudioRecordButton';
import { createExcalidraw } from '../Excalidraw/Excalidraw';
import { ExcalidrawButton } from '../Excalidraw/ExcalidrawButton';
import { createFile } from '../File/File';
import { createImage } from '../Image/Image';
import { createVideo } from '../Video/Video';
import { AttachmentFilePickerButton } from './AttachmentFilePickerButton';
import { insertAttachmentNode } from './createAttachmentNode';
import type { AttachmentDeps } from './deps';

// The drawing node view imports the real canvas library, which jsdom cannot run.
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

const FACTORY: Record<AttachmentKind, (getDeps: () => AttachmentDeps) => AnyExtension> = {
  image: createImage,
  audio: createAudio,
  video: createVideo,
  file: createFile,
  excalidraw: createExcalidraw,
};

const BUTTON: Record<AttachmentKind, unknown> = {
  image: AttachmentFilePickerButton,
  audio: AudioRecordButton,
  video: AttachmentFilePickerButton,
  file: AttachmentFilePickerButton,
  excalidraw: ExcalidrawButton,
};

/** The picker kinds and what `pickerButton` hands them. */
const PICKER: Partial<Record<AttachmentKind, { icon: string; accept: string | undefined }>> = {
  image: { icon: 'ImagePlus', accept: 'image/*' },
  video: { icon: 'FileVideo', accept: 'video/*' },
  file: { icon: 'Paperclip', accept: undefined },
};

const deps = { t: (k: string) => k } as unknown as AttachmentDeps;
const editors: Editor[] = [];
afterEach(() => {
  for (const e of editors.splice(0)) e.destroy();
});

function editorWith(kind: AttachmentKind, content = '<p></p>') {
  const extension = FACTORY[kind](() => deps);
  const editor = new Editor({ extensions: [Document, Paragraph, Text, extension], content });
  editors.push(editor);
  return editor;
}

describe.each(ATTACHMENT_KINDS)('%s node', (kind) => {
  const { tag } = ATTACHMENT_SPECS[kind];
  const open = `<${tag} data-attachment-id="x1">`;
  const close = tag === 'img' ? '' : `</${tag}>`;

  it('parses its Body tag and re-renders it with the id and no src, href or payload', () => {
    const editor = editorWith(kind, `${open}${close}`);
    expect(editor.getHTML()).toBe(`${open}${close}`);
  });

  it('inserts a node carrying the id, and a second insert lands after the first', () => {
    const editor = editorWith(kind);
    expect(insertAttachmentNode(editor, kind, 'a')).toBe(true);
    expect(insertAttachmentNode(editor, kind, 'b')).toBe(true);
    const html = editor.getHTML();
    const a = html.indexOf('data-attachment-id="a"');
    const b = html.indexOf('data-attachment-id="b"');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
  });

  it('is named after its kind, which the toolbar registry resolves by', () => {
    const editor = editorWith(kind);
    expect(editor.extensionManager.extensions.some((e) => e.name === `${kind}Attachment`)).toBe(
      true
    );
  });

  it("yields its kind's button with the editor and the kind's tooltip", () => {
    const editor = editorWith(kind);
    const ext = editor.extensionManager.extensions.find((e) => e.name === `${kind}Attachment`);
    const view = ext?.options.button({ editor, t: deps.t }) as {
      component: unknown;
      componentProps: { editor?: Editor; tooltip: string; icon?: string; accept?: string };
    };
    expect(view.component).toBe(BUTTON[kind]);
    expect(view.componentProps.tooltip).toBe(`editor.${kind}.tooltip`);
    const picker = PICKER[kind];
    if (picker) {
      expect(view.componentProps.icon).toBe(picker.icon);
      expect(view.componentProps.accept).toBe(picker.accept);
    } else {
      // A picker holds the editor in its onFiles closure rather than as a prop.
      expect(view.componentProps.editor).toBe(editor);
    }
  });
});
