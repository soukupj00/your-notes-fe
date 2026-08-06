import { describe, expect, it } from 'vitest';
import { bodyHasAttachment, extractAttachmentIds } from './attachment-html';

describe('bodyHasAttachment', () => {
  it('is true when the HTML contains an img with data-attachment-id', () => {
    expect(bodyHasAttachment('<p>hi</p><img data-attachment-id="abc">')).toBe(true);
  });

  it('is false for plain text or an img without the marker', () => {
    expect(bodyHasAttachment('<p>hi</p>')).toBe(false);
    expect(bodyHasAttachment('<img src="x.png">')).toBe(false);
    expect(bodyHasAttachment('')).toBe(false);
    expect(bodyHasAttachment(undefined)).toBe(false);
  });

  it('does not leak lastIndex state across repeated calls (shared g-flag regex)', () => {
    const html = '<img data-attachment-id="abc">';
    expect(bodyHasAttachment(html)).toBe(true);
    expect(bodyHasAttachment(html)).toBe(true);
    expect(bodyHasAttachment(html)).toBe(true);
  });

  it('extractAttachmentIds is unaffected by a prior bodyHasAttachment call', () => {
    expect(bodyHasAttachment('<img data-attachment-id="abc">')).toBe(true);
    expect(
      extractAttachmentIds(
        '<img data-attachment-id="first"><img data-attachment-id="second">'
      ).sort()
    ).toEqual(['first', 'second']);
  });
});

describe('extractAttachmentIds', () => {
  it('collects every data-attachment-id, de-duplicated', () => {
    const html =
      '<img data-attachment-id="a"><p>x</p><img data-attachment-id="b"><img data-attachment-id="a">';
    expect(extractAttachmentIds(html).sort()).toEqual(['a', 'b']);
  });

  it('returns [] for empty / nullish input', () => {
    expect(extractAttachmentIds('')).toEqual([]);
    expect(extractAttachmentIds(null)).toEqual([]);
  });
});
