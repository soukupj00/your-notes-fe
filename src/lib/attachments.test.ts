import { describe, expect, it } from 'vitest';
import { CANDIDATE_MIME } from '@/components/editor/extensions/Audio/useAudioRecorder.ts';
import { ATTACHMENT_KINDS, type AttachmentKind } from '@/models.ts';
import {
  ATTACHMENT_SPECS,
  baseMimeType,
  fileExtension,
  fileMatchesKind,
  validateAttachmentFile,
} from './attachments.ts';

function fileOf(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'f', { type });
}

/** A type each kind accepts, for the cases every kind shares. */
const ACCEPTED: Record<AttachmentKind, string> = {
  image: 'image/png',
  audio: 'audio/webm',
  video: 'video/mp4',
  file: 'application/pdf',
  excalidraw: 'application/json',
};

describe.each(ATTACHMENT_KINDS)('%s', (kind) => {
  const { maxBytes } = ATTACHMENT_SPECS[kind];

  it('accepts a file of exactly the cap and rejects one byte over', () => {
    expect(validateAttachmentFile(fileOf(ACCEPTED[kind], maxBytes), kind)).toBeNull();
    expect(validateAttachmentFile(fileOf(ACCEPTED[kind], maxBytes + 1), kind)).toBe('too-large');
  });

  it('has a lowercase Body tag of its own, which the Body readers rely on', () => {
    const { tag } = ATTACHMENT_SPECS[kind];
    expect(tag).toBe(tag.toLowerCase());
    expect(ATTACHMENT_KINDS.filter((k) => ATTACHMENT_SPECS[k].tag === tag)).toEqual([kind]);
  });
});

describe('whitelists', () => {
  it('image: rejects SVG and documents, which can carry script', () => {
    expect(validateAttachmentFile(fileOf('image/svg+xml'), 'image')).toBe('unsupported-type');
    expect(validateAttachmentFile(fileOf('application/pdf'), 'image')).toBe('unsupported-type');
    expect(validateAttachmentFile(fileOf('image/webp'), 'image')).toBeNull();
  });

  it('image: the cap stays the documented 10 MB', () => {
    expect(ATTACHMENT_SPECS.image.maxBytes).toBe(10 * 1024 * 1024);
  });

  it('audio and video: the formats users attach; a codec parameter does not change the answer', () => {
    for (const mime of ['audio/webm;codecs=opus', 'audio/mpeg', 'audio/wav']) {
      expect(validateAttachmentFile(fileOf(mime), 'audio'), mime).toBeNull();
    }
    expect(validateAttachmentFile(fileOf('audio/flac;codecs=flac'), 'audio')).toBe(
      'unsupported-type'
    );
    for (const mime of ['video/mp4;codecs=avc1', 'video/webm', 'video/quicktime']) {
      expect(validateAttachmentFile(fileOf(mime), 'video'), mime).toBeNull();
    }
    expect(validateAttachmentFile(fileOf('image/png'), 'video')).toBe('unsupported-type');
  });

  it('file: any type under the cap', () => {
    for (const type of ['application/pdf', 'application/zip', 'application/octet-stream']) {
      expect(validateAttachmentFile(fileOf(type), 'file')).toBeNull();
    }
  });

  it('excalidraw: a JSON scene only', () => {
    expect(validateAttachmentFile(fileOf('application/json'), 'excalidraw')).toBeNull();
    expect(validateAttachmentFile(fileOf('image/png'), 'excalidraw')).toBe('unsupported-type');
  });

  it('every MIME the in-app recorder may pick is accepted as audio', () => {
    for (const mime of CANDIDATE_MIME) {
      expect(validateAttachmentFile(fileOf(mime), 'audio'), mime).toBeNull();
    }
  });

  it('rejects a kind this build does not know, such as a row from a newer Device', () => {
    for (const kind of ['hologram', 'constructor'] as unknown as AttachmentKind[]) {
      expect(validateAttachmentFile(fileOf('image/png'), kind), kind).toBe('unsupported-type');
    }
  });
});

describe('fileMatchesKind', () => {
  it('routes a file by its MIME prefix; a document is a file and nothing is a drawing', () => {
    const png = fileOf('image/png');
    expect(fileMatchesKind(png, 'image')).toBe(true);
    expect(fileMatchesKind(png, 'video')).toBe(false);
    expect(fileMatchesKind(png, 'file')).toBe(true);
    expect(fileMatchesKind(fileOf('application/pdf'), 'file')).toBe(true);
    expect(fileMatchesKind(fileOf('application/json'), 'excalidraw')).toBe(false);
  });
});

describe('fileExtension and baseMimeType', () => {
  it('names a recording by its base MIME and a drawing by its scene type', () => {
    expect(fileExtension('audio', 'audio/webm;codecs=opus')).toBe('webm');
    expect(fileExtension('audio', 'audio/mp4')).toBe('m4a');
    expect(fileExtension('audio', 'audio/flac')).toBeUndefined();
    expect(fileExtension('excalidraw', 'application/json')).toBe('excalidraw.json');
    expect(baseMimeType('video/mp4;codecs=avc1')).toBe('video/mp4');
  });
});
