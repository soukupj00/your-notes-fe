# 0026 - Shortcuts are one Preference, matched by one key name

- Status: Accepted
- Date: 2026-10-22

## Context

The first user test asked for keyboard shortcuts the user can change.
Until then the editor's keys were TipTap's defaults, the search key came from `react-hotkeys-hook`, and the new-note key was a one-letter Preference matched on `event.key`.
Three matchers named a key press three ways, so a key recorded in Settings could not be trusted to fire where it was used.
TipTap's keymaps are fixed when the editor is built, while a note can stay open while the user changes a key in another tab.

## Decision

**Every Shortcut, the editor's and the two app-wide ones, is one entry in one Preference, and every key press is named one way.**

- `lib/key-combo.ts` names a press as ProseMirror does (`Mod-Shift-8`, `Mod-b`, `n`), through `w3c-keyname`.
  The recorder in Settings and every matcher use that name, so what is recorded is what fires.
- The Preference stores only the user's changes, `null` for a cleared Shortcut; the defaults live in `lib/shortcuts.ts`.
  It is a Preference, so it belongs to the Device, like the toolbar Layout.
- The editor binds no command key of its own.
  The upstream bindings of every customisable action are stripped, and one plugin (`extensions/Shortcuts/`) reads the live bindings on each key press, so a change reaches an open note at once.
  Only typing and editing keys stay upstream: select all, the clipboard, Enter and Backspace with Mod, and Mod-Alt-0 for a paragraph.
- A combination is unique per scope: `app` (new note, search) and `editor`.
  So Ctrl+K is search outside a note and Link inside one.
  A duplicate is refused in Settings, with an offer to take it over from its owner.
- One key per action.
  Redo is Ctrl+Shift+Z only; TipTap's second binding, Ctrl+Y, is gone.
- On Windows, Ctrl+Alt is AltGr.
  A press that types a character there is typing, never a Shortcut, and Settings refuses to record it.
- Keys the browser keeps (Ctrl+W, Ctrl+T, Ctrl+N and their kin) are refused.
  An editor Shortcut needs Ctrl, Cmd or Alt; an app-wide one may be a single key, which never fires inside a field.

## Considered options

- **Keep TipTap's keymaps and rebuild the editor when a key changes.**
  Rejected: rebuilding loses the selection and the undo history of an open note.
- **Store every Shortcut, defaults included.**
  Rejected: a changed default would never reach a user who had saved any key.
- **Allow several keys per action.**
  Rejected: Settings would need a list per row, for a need nobody raised.

## Consequences

- Ctrl+Y no longer redoes.
- A tooltip shows the user's key, or none when it is cleared, because the toolbar reads the same Preference.
- Adding an editor action with a shortcut means a row in `SHORTCUTS`, an entry in `EDITOR_ACTIONS`, and stripping its upstream key; `shortcuts.test.ts` fails if a command key is left bound.
