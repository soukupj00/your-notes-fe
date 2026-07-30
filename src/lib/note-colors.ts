/**
 * The shared Note/Tag colour palette (ADR 0009, "Color" in CONTEXT.md).
 *
 * A Note stores a *token key* from this list, never a raw colour value, so the
 * concrete shade resolves from the active Theme. A token reaches CSS as a
 * `data-note-color` attribute, and `styles/globals.css` derives the whole
 * identity from it per theme: `--note-surface`, `--note-border`, `--note-chip`,
 * `--note-on-chip` and the elevation (a drop shadow by day, a glow by night).
 * A colour-blind theme variant can therefore re-tint the whole palette by
 * overriding that one block, with no data change and no component change.
 *
 * `default` is the absence of a colour - it resolves to the normal card
 * surface. It is a real token (not `undefined`) so the picker can offer a
 * "no colour" swatch, but it is never persisted; clearing a colour clears the
 * field.
 */
export const NOTE_COLORS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'gray',
] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

/** The tokens a user can actually persist (everything but the "no colour" one). */
export const ASSIGNABLE_NOTE_COLORS = NOTE_COLORS.filter(
  (token): token is Exclude<NoteColor, 'default'> => token !== 'default'
);

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value);
}

/**
 * Props spreading a stored token onto an element so CSS can derive the identity
 * from it. Unknown tokens resolve to `default`, so a note carrying a token from
 * a future palette renders as an uncoloured note rather than as a broken colour.
 *
 * The attribute is always present, even for `default`, because that is what lets
 * a component read `--note-surface` unconditionally instead of branching on
 * whether a colour was assigned.
 */
export function noteColorAttrs(token: string | undefined): { 'data-note-color': NoteColor } {
  return { 'data-note-color': isNoteColor(token) ? token : 'default' };
}
