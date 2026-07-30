import { describe, expect, it } from 'vitest';
import { isNoteColor, noteColorAttrs } from './note-colors.ts';

describe('note colours', () => {
  it('preserves every stored palette token', () => {
    expect(noteColorAttrs('blue')).toEqual({ 'data-note-color': 'blue' });
    expect(isNoteColor('gray')).toBe(true);
  });

  it('renders missing or future tokens as the default identity', () => {
    expect(noteColorAttrs(undefined)).toEqual({ 'data-note-color': 'default' });
    expect(noteColorAttrs('future-colour')).toEqual({ 'data-note-color': 'default' });
  });
});
