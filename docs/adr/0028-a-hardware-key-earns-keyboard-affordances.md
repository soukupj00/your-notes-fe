# 0028 - A hardware key earns keyboard affordances

- Status: Accepted, amends [ADR 0016](./0016-width-decides-layout-pointer-decides-affordances.md)
- Date: 2026-10-25

## Context

ADR 0016 offers keyboard hints only to a Fine pointer, because a phone has no keys to press.
A touch tablet in a keyboard case is the case it misses: its primary pointer is Coarse, so it got no shortcut chips, no new-note key and no Shortcuts page, though it has every key a laptop has.
No media query reports a keyboard, so the pointer was standing in for one.

## Decision

**Keyboard affordances are offered when any pointer is Fine, or once a hardware key has been pressed this session.**

- Any pointer, not the primary one (`any-pointer: fine`): an iPad with a trackpad case or a Surface in tablet mode reports a Coarse primary, yet its trackpad comes with keys.

- `useKeyboardAffordances` answers it; `isHardwareKey` (`lib/hardware-key.ts`) decides what counts.
- A key counts when it can only have come from a hardware keyboard: a printable key, an arrow, Tab or Escape outside a field, or any key with Ctrl, Cmd or Alt held.
  A key typed into a field never counts alone, because a software keyboard types there too; nor does an untrusted event, IME composition, or Android's `Unidentified`/229.
- What was seen is kept in `sessionStorage`: a reload in the same tab keeps it, while a new tab or launch, where the keyboard may be detached, starts without.
- The new-note key asks at the press, so the first N both arms the affordances and opens a Note.
  WCAG 2.1.4 still holds: the Shortcuts page, where the key is turned off, appears with the same press.
- Affordances follow the keyboard: the shortcut chips, the tooltip hints, the new-note key, the Shortcuts page and focusing an existing Note's title on open.
  What a pointer decides stays with the pointer: File in Camera's quick capture slot, and the toolbar's Width Class.

## Considered options

- **Persist the seen key across launches (`localStorage`).**
  Rejected: the tablet without its case would show hints for keys it no longer has, until something reset them.
- **Arm on any keydown.**
  Rejected: an iPad's software keyboard sends real keys into a field, so typing a search would arm hints on a device with no keyboard.

## Consequences

- On a touch-only device the hints appear after the first hardware key, never before it.
- A reload keeps them, so the Shortcuts page opened cold after a reload renders; a new tab starts without them until its first key.
- The Width Class is unchanged: a tablet with a keyboard keeps the Compact toolbar, whose 44px slots answer the touch screen, not the keys.
