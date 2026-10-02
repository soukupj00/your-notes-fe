/**
 * Note/Tag palette tokens (ADR 0009, CONTEXT.md "Color"). `globals.css` derives each identity from
 * `data-note-color` per theme, so a colour-blind variant re-tints by CSS alone. `default` means no
 * colour: a real token so the picker can offer it, but never persisted.
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
 * An unknown token, say from a future palette, renders as uncoloured rather than broken. Always
 * present, even for `default`, so a component reads `--note-surface` without branching.
 */
export function noteColorAttrs(token: string | undefined): { 'data-note-color': NoteColor } {
  return { 'data-note-color': isNoteColor(token) ? token : 'default' };
}
