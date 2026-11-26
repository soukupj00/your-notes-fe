/**
 * Whether a keydown belongs to an IME composition, such as the Enter that confirms a Japanese
 * conversion. Safari does not set `isComposing` on that Enter but reports it as key 229.
 */
export function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229;
}
