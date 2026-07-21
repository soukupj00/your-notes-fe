import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateImageFile } from './attachments';

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
