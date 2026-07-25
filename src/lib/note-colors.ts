/**
 * The shared Note/Tag colour palette (ADR 0009, "Color" in CONTEXT.md).
 *
 * A Note stores a *token key* from this list, never a raw colour value, so the
 * concrete shade resolves from the active Theme. Each token maps to a pair of
 * CSS custom properties defined per-theme in `styles/globals.css`:
 * `--note-<token>` (surface) and `--note-<token>-border`. A colour-blind theme
 * variant can therefore re-tint the whole palette by overriding those vars
 * alone, with no data change and no component change.
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
 * Inline style resolving a stored token to the themed surface + border.
 * Unknown or absent tokens fall through to the default card surface, so a note
 * carrying a token from a future palette never renders as a broken colour.
 */
export function noteColorStyle(token: string | undefined): React.CSSProperties | undefined {
  if (!token || !isNoteColor(token) || token === 'default') return undefined;
  return {
    backgroundColor: `var(--note-${token})`,
    borderColor: `var(--note-${token}-border)`,
  };
}
