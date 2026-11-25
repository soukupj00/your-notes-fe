import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/format.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import { attachmentLabelName } from './attachmentLabelName';

const STRINGS: Record<string, string> = {
  'editor.audio.label': 'Voice recording',
  'editor.excalidraw.label': 'Drawing',
  'editor.file.label': 'File',
  'editor.image.label': 'Image',
  'editor.attachment.madeAt': '{{kind}}, {{time}}',
};
const t = (key: string, opts: Record<string, unknown> = {}) =>
  STRINGS[key].replace(/{{(\w+)}}/g, (_, name: string) => String(opts[name]));
const deps = { t, locale: 'en' };

const MADE = '2026-11-25T13:05:00.000Z';
const at = (iso: string) => formatDate(iso, 'en', { dateStyle: 'medium', timeStyle: 'medium' });

function row(kind: AttachmentKind, name: string | undefined, createdAt = MADE): Attachment {
  return { id: 'a1', noteId: 'n1', kind, mime: '', name, createdAt, updatedAt: createdAt };
}

describe('attachmentLabelName', () => {
  it.each([
    ['an uploaded file by its name', row('file', 'minutes.txt'), 'minutes.txt'],
    ['an uploaded clip by its name', row('audio', 'standup.wav'), 'standup.wav'],
    [
      'a recording by its kind and time',
      row('audio', 'recording.webm'),
      `voice recording, ${at(MADE)}`,
    ],
    [
      'a drawing by its kind and time',
      row('excalidraw', 'drawing.excalidraw.json'),
      `drawing, ${at(MADE)}`,
    ],
    ['a row with no name by its kind and time', row('file', undefined), `file, ${at(MADE)}`],
    [
      'a camera shot or pasted picture by its kind and time',
      row('image', 'image.jpg'),
      `image, ${at(MADE)}`,
    ],
    [
      'a picture the user named by its name',
      row('image', 'image-of-the-sea.jpg'),
      'image-of-the-sea.jpg',
    ],
  ])('names %s', (_case, attachment, expected) => {
    expect(attachmentLabelName(attachment.kind, attachment, deps)).toBe(expected);
  });

  it('tells two recordings made in the same minute apart', () => {
    const first = attachmentLabelName('audio', row('audio', 'recording.webm'), deps);
    const second = attachmentLabelName(
      'audio',
      row('audio', 'recording.webm', '2026-11-25T13:05:20.000Z'),
      deps
    );

    expect(first).not.toBe(second);
  });

  it('names a row it cannot read yet by its kind alone', () => {
    expect(attachmentLabelName('audio', undefined, deps)).toBe('voice recording');
    expect(attachmentLabelName('excalidraw', null, deps)).toBe('drawing');
  });
});
