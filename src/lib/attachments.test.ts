import { describe, expect, it } from 'vitest';
import {
  MAX_AUDIO_BYTES,
  MAX_EXCALIDRAW_BYTES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  validateAttachmentFile,
  validateImageFile,
} from './attachments';

function fileOfType(type: string, size = 10): File {
  const f = new File([new Uint8Array(size)], 'x', { type });
  return f;
}

function fileOf(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'x', { type });
}

describe('validateImageFile', () => {
  it('accepts a whitelisted image type under the size cap', () => {
    expect(validateImageFile(fileOfType('image/png'))).toBeNull();
    expect(validateImageFile(fileOfType('image/webp'))).toBeNull();
  });

  it('rejects a non-whitelisted type (e.g. SVG)', () => {
    expect(validateImageFile(fileOfType('image/svg+xml'))).toBe('unsupported-type');
    expect(validateImageFile(fileOfType('application/pdf'))).toBe('unsupported-type');
  });

  it('accepts a file of exactly the size cap', () => {
    const exact = fileOfType('image/png', MAX_IMAGE_BYTES);
    expect(validateImageFile(exact)).toBeNull();
  });

  it('rejects an oversized file', () => {
    const big = fileOfType('image/png', MAX_IMAGE_BYTES + 1);
    expect(validateImageFile(big)).toBe('too-large');
  });
});

describe('validateAttachmentFile', () => {
  it('image kind keeps the existing image rules', () => {
    expect(validateAttachmentFile(fileOfType('image/png'), 'image')).toBeNull();
    expect(validateAttachmentFile(fileOfType('image/svg+xml'), 'image')).toBe('unsupported-type');
  });

  it('audio kind accepts whitelisted audio under the cap', () => {
    expect(validateAttachmentFile(fileOfType('audio/webm'), 'audio')).toBeNull();
    expect(validateAttachmentFile(fileOfType('audio/mpeg'), 'audio')).toBeNull();
  });

  it('audio kind rejects a non-audio type', () => {
    expect(validateAttachmentFile(fileOfType('image/png'), 'audio')).toBe('unsupported-type');
  });

  it('audio kind accepts a codec-qualified MIME on the whitelisted base type', () => {
    // MediaRecorder output (e.g. useAudioRecorder's picked candidate) carries a
    // codec param the whitelist's exact-match check used to reject outright.
    expect(validateAttachmentFile(fileOfType('audio/webm;codecs=opus'), 'audio')).toBeNull();
  });

  it('audio kind rejects a codec-qualified MIME whose base type is not whitelisted', () => {
    expect(validateAttachmentFile(fileOfType('audio/aac'), 'audio')).toBe('unsupported-type');
    expect(validateAttachmentFile(fileOfType('audio/flac;codecs=flac'), 'audio')).toBe(
      'unsupported-type'
    );
  });

  it('audio kind rejects oversized and accepts exactly the cap', () => {
    expect(validateAttachmentFile(fileOfType('audio/webm', MAX_AUDIO_BYTES + 1), 'audio')).toBe(
      'too-large'
    );
    expect(validateAttachmentFile(fileOfType('audio/webm', MAX_AUDIO_BYTES), 'audio')).toBeNull();
  });

  it('video kind accepts whitelisted video under the cap', () => {
    expect(validateAttachmentFile(fileOfType('video/mp4'), 'video')).toBeNull();
    expect(validateAttachmentFile(fileOfType('video/webm'), 'video')).toBeNull();
  });

  it('video kind rejects a non-video type', () => {
    expect(validateAttachmentFile(fileOfType('image/png'), 'video')).toBe('unsupported-type');
  });

  it('video kind accepts a codec-qualified MIME on the whitelisted base type', () => {
    expect(validateAttachmentFile(fileOfType('video/mp4;codecs=avc1'), 'video')).toBeNull();
  });

  it('video kind rejects oversized and accepts exactly the cap', () => {
    expect(validateAttachmentFile(fileOfType('video/mp4', MAX_VIDEO_BYTES + 1), 'video')).toBe(
      'too-large'
    );
    expect(validateAttachmentFile(fileOfType('video/mp4', MAX_VIDEO_BYTES), 'video')).toBeNull();
  });
});

describe('validateAttachmentFile - file kind', () => {
  it('accepts any MIME type under the cap', () => {
    expect(validateAttachmentFile(fileOfType('application/pdf'), 'file')).toBeNull();
    expect(validateAttachmentFile(fileOfType('application/zip'), 'file')).toBeNull();
    expect(validateAttachmentFile(fileOfType('application/octet-stream'), 'file')).toBeNull();
  });

  it('rejects oversized and accepts exactly the cap', () => {
    expect(validateAttachmentFile(fileOfType('application/pdf', MAX_FILE_BYTES + 1), 'file')).toBe(
      'too-large'
    );
    expect(
      validateAttachmentFile(fileOfType('application/pdf', MAX_FILE_BYTES), 'file')
    ).toBeNull();
  });
});

describe('validateAttachmentFile - excalidraw', () => {
  it('accepts an application/json scene under the cap', () => {
    expect(validateAttachmentFile(fileOf('application/json'), 'excalidraw')).toBeNull();
  });

  it('rejects a non-json type', () => {
    expect(validateAttachmentFile(fileOf('image/png'), 'excalidraw')).toBe('unsupported-type');
  });

  it('rejects oversize and accepts exactly the cap', () => {
    expect(
      validateAttachmentFile(fileOf('application/json', MAX_EXCALIDRAW_BYTES + 1), 'excalidraw')
    ).toBe('too-large');
    expect(
      validateAttachmentFile(fileOf('application/json', MAX_EXCALIDRAW_BYTES), 'excalidraw')
    ).toBeNull();
  });
});
