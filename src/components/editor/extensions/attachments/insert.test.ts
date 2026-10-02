import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentError } from '@/lib/attachments.ts';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import { createAudio } from '../Audio/Audio';
import { createFile } from '../File/File';
import { createImage } from '../Image/Image';
import { createVideo } from '../Video/Video';
import type { AttachmentDeps } from './deps';
import { insertFiles, insertTransferredFiles } from './insert';

vi.mock('@/lib/image-thumbnail.ts', () => ({ generateImageThumbnail: vi.fn(async () => ({})) }));
vi.mock('@/lib/video-poster.ts', () => ({ generateVideoPoster: vi.fn(async () => ({})) }));

const t = (k: string) => k;

function stubDeps(): AttachmentDeps {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn(
      async (noteId: string, file: File, kind: AttachmentKind) =>
        ({
          id: `att-${file.name}`,
          noteId,
          kind,
          mime: file.type,
          blob: file,
          name: file.name,
          createdAt: '',
          updatedAt: '',
        }) as Attachment
    ),
    getAttachment: vi.fn(async () => undefined),
    watchAttachment: vi.fn(),
    downloadAttachment: vi.fn(async () => false),
    cloneAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    openExcalidraw: vi.fn(),
    onError: vi.fn(),
    t,
  };
}

const fileOf = (name: string, type: string) => new File([new Uint8Array(4)], name, { type });

let editor: Editor;
let deps: AttachmentDeps;
beforeEach(() => {
  vi.mocked(generateImageThumbnail).mockResolvedValue({});
  vi.mocked(generateVideoPoster).mockResolvedValue({});
  deps = stubDeps();
  const getDeps = () => deps;
  editor = new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      createImage(getDeps),
      createAudio(getDeps),
      createVideo(getDeps),
      createFile(getDeps),
    ],
    content: '<p></p>',
  });
});
afterEach(() => editor.destroy());

const KINDS: { kind: AttachmentKind; file: File }[] = [
  { kind: 'image', file: fileOf('a.png', 'image/png') },
  { kind: 'audio', file: fileOf('m.webm', 'audio/webm') },
  { kind: 'video', file: fileOf('c.mp4', 'video/mp4') },
  { kind: 'file', file: fileOf('d.pdf', 'application/pdf') },
];

describe.each(KINDS)('insertFiles $kind', ({ kind, file }) => {
  it('stores one row per file of its kind, asks for the note id once, and places a node each', async () => {
    const second = fileOf(`2-${file.name}`, file.type);
    await insertFiles(kind, editor, [file, second], deps);
    expect(deps.getNoteId).toHaveBeenCalledOnce();
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', file, kind, {});
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', second, kind, {});
    const html = editor.getHTML();
    expect(html).toContain(`data-attachment-id="att-${file.name}"`);
    expect(html).toContain(`data-attachment-id="att-2-${file.name}"`);
  });

  it('reports a validation failure by its code and a crash as insert-failed, and carries on', async () => {
    vi.mocked(deps.createAttachment)
      .mockRejectedValueOnce(new AttachmentError('too-large'))
      .mockRejectedValueOnce(new Error('boom'));
    await expect(
      insertFiles(kind, editor, [file, fileOf(`2-${file.name}`, file.type)], deps)
    ).resolves.toBeUndefined();
    expect(deps.onError).toHaveBeenNthCalledWith(1, 'too-large', kind);
    expect(deps.onError).toHaveBeenNthCalledWith(2, 'insert-failed', kind);
    expect(editor.getHTML()).not.toContain('data-attachment-id');
  });

  it('reports a note that could not be created as insert-failed, and stores nothing', async () => {
    vi.mocked(deps.getNoteId).mockRejectedValueOnce(new Error('draft write failed'));
    await expect(insertFiles(kind, editor, [file], deps)).resolves.toBeUndefined();
    expect(deps.onError).toHaveBeenCalledWith('insert-failed', kind);
    expect(deps.createAttachment).not.toHaveBeenCalled();
    expect(editor.getHTML()).not.toContain('data-attachment-id');
  });
});

describe('insertFiles filtering', () => {
  it('takes only files of the kind, and asks for nothing when none match', async () => {
    await insertFiles('image', editor, [fileOf('n.txt', 'text/plain')], deps);
    expect(deps.getNoteId).not.toHaveBeenCalled();
    await insertFiles(
      'video',
      editor,
      [fileOf('a.png', 'image/png'), fileOf('c.mp4', 'video/mp4')],
      deps
    );
    expect(deps.createAttachment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.createAttachment).mock.calls[0][2]).toBe('video');
  });

  it('a file takes any type; a drawing never comes from a file', async () => {
    await insertFiles('file', editor, [fileOf('a.png', 'image/png')], deps);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', expect.anything(), 'file', {});
    await insertFiles('excalidraw', editor, [fileOf('s.json', 'application/json')], deps);
    expect(deps.createAttachment).toHaveBeenCalledTimes(1);
  });
});

describe('derived data', () => {
  it('an image stores its thumbnail and size with the row', async () => {
    const thumbnail = new Blob(['small'], { type: 'image/webp' });
    vi.mocked(generateImageThumbnail).mockResolvedValue({ thumbnail, width: 1600, height: 1000 });
    const png = fileOf('large.png', 'image/png');
    await insertFiles('image', editor, [png], deps);
    expect(generateImageThumbnail).toHaveBeenCalledWith(png);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png, 'image', {
      thumbnail,
      width: 1600,
      height: 1000,
    });
  });

  it('a video stores its poster as the thumbnail, with duration and size, whichever path it came by', async () => {
    const poster = new Blob(['frame'], { type: 'image/webp' });
    vi.mocked(generateVideoPoster).mockResolvedValue({
      poster,
      duration: 12,
      width: 1280,
      height: 720,
    });
    const clip = fileOf('c.mp4', 'video/mp4');
    await insertFiles('video', editor, [clip], deps);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', clip, 'video', {
      thumbnail: poster,
      duration: 12,
      width: 1280,
      height: 720,
    });
  });

  it('leaves out what a deriver could not produce, and validates before deriving', async () => {
    vi.mocked(generateVideoPoster).mockResolvedValue({ duration: 3 });
    await insertFiles('video', editor, [fileOf('c.mp4', 'video/mp4')], deps);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', expect.anything(), 'video', {
      duration: 3,
    });
    vi.mocked(generateVideoPoster).mockClear();
    await insertFiles('video', editor, [fileOf('x.mkv', 'video/x-matroska')], deps);
    expect(deps.onError).toHaveBeenCalledWith('unsupported-type', 'video');
    expect(generateVideoPoster).not.toHaveBeenCalled();
  });
});

describe('insertTransferredFiles', () => {
  function fileList(...files: File[]): FileList {
    return files as unknown as FileList;
  }

  it('routes every file of a mixed transfer to its own kind', async () => {
    const png = fileOf('a.png', 'image/png');
    const clip = fileOf('c.mp4', 'video/mp4');
    expect(insertTransferredFiles(editor, fileList(png, clip), deps)).toBe(true);
    await vi.waitFor(() => expect(deps.createAttachment).toHaveBeenCalledTimes(2));
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png, 'image', {});
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', clip, 'video', {});
    await vi.waitFor(() => {
      const html = editor.getHTML();
      expect(html).toContain('data-attachment-id="att-a.png"');
      expect(html).toContain('data-attachment-id="att-c.mp4"');
    });
  });

  it('leaves a transfer with no media to the browser', () => {
    expect(insertTransferredFiles(editor, fileList(fileOf('d.pdf', 'application/pdf')), deps)).toBe(
      false
    );
    expect(deps.getNoteId).not.toHaveBeenCalled();
  });
});
