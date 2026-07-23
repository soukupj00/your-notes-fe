import { describe, expect, it } from 'vitest';
import {
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  validateAttachmentFile,
  validateImageFile,
} from './attachments';

function fileOfType(type: string, size = 10): File {
  const f = new File([new Uint8Array(size)], 'x', { type });
  return f;
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
});
