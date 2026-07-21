import { describe, expect, it } from 'vitest';
import { stripHtml } from './utils';

describe('stripHtml', () => {
  it('removes tags and keeps text content', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('collapses whitespace left behind by removed tags', () => {
    expect(stripHtml('<ul><li>a</li><li>b</li></ul>')).toBe('a b');
  });

  it('decodes common entities', () => {
    expect(stripHtml('<p>Tom &amp; Jerry &lt;3</p>')).toBe('Tom & Jerry <3');
    expect(stripHtml('a&nbsp;b')).toBe('a b');
  });

  it('returns an empty string for empty, null, or undefined input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
  });
});
