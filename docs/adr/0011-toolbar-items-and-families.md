# Toolbar Items and Families over a flat button list

The customisable toolbar was planned as `prefs.toolbar: string[]` of TipTap extension names, but extension names are not buttons (`heading` yields three, `textAlign` three, `history` two), so that shape cannot express "H1 alone", "all three headings" or "one heading dropdown".
We introduce a **Toolbar Item** registry with a stable id space of its own, group Items into **Families** that are shown either expanded or collapsed, and store one **Toolbar Layout** per **Width Class** as structured per-family records rather than a flat array of ids.
The numbered decisions that code comments cite as "ADR 0011, decision N" are the list under [Decisions](#decisions).

## Considered options

- **Flat `string[]` of extension names.** Cheapest and matches the original plan, but cannot address a single heading level or a collapsed group, and re-admits the invalid state "a collapsed menu plus its own leaves on the same bar" that the family model makes unrepresentable.
- **One ranked list with measured mobile overflow.** One thing to configure and it deletes the developer-owned `hideOnMobile` layout, but it makes "off" and "ranked low" different states that both need reaching, and requires a `ResizeObserver` on a bar that sits above a viewport-resizing keyboard.
- **Two Layouts of structured family records** (chosen). Two things to configure, and the settings UI needs a Width Class toggle, but each Layout is a direct description of one bar with no measurement anywhere.

## Decisions

Taken in the 2026-08-03 grilling session.
Vocabulary is in [`CONTEXT.md`](https://github.com/soukupj00/your-notes-fe/blob/main/CONTEXT.md) under *Editing*: **Toolbar Family**, **Toolbar Item**, **Toolbar Layout**, **Width Class**.

1. **The unit is a Toolbar Item, not an extension name.**
   A registry maps a stable id to an icon, a label, a family, and the extension button view it renders.
   Behaviour stays with the extension (Pattern A holds).
2. **Two Layouts, one per Width Class.**
   Not one list with priority overflow.
   The settings editor has a Compact/Wide toggle at the top and edits one at a time.
3. **`hideOnMobile` is deleted.**
   Its information moves into the Compact preset.
   Nothing about which buttons a phone shows stays in extension code.
4. **The Compact bar is one row with horizontal scroll**, never wrapping.
   It is sticky above the keyboard; stealing vertical space from the note is the one thing it may not do.
   No measurement, no overflow popover.
5. **Families are the unit of the settings UI**, each expanded or collapsed.
   "A collapsed menu plus its own leaves on the same bar" is unrepresentable rather than merely invalid.
6. **A collapsed family reports its state.**
   The trigger's icon is the family's current state (`¶` / `H2`, the active list type, the current alignment); action-only families fall back to a static icon.
   Collapsing costs information, and this is what pays it back.
7. **The popover holds the real leaf buttons.**
   Same `ActionButton`s, same `isActive`, same tooltips.
   Per-leaf on/off still applies inside a collapsed family, and a family with every leaf off does not render.
8. **Absent means new, not hidden.**
   Reconciliation against the registry on read: registry ids missing from the blob are appended at their registry position with their default state, so a button shipped next release appears for existing users.
   Ids in the blob missing from the registry are kept in storage but not rendered, so a temporarily unregistered extension cannot erase an arrangement.
9. **Presets are a stamp, not a mode.**
   Minimal / Balanced / Everything write a full Layout into the current Width Class.
   There is no "am I still on a preset" state, and Reset is re-stamping the Width Class's default preset (Balanced on Compact, Minimal on Wide since 2026-10-21).
10. **Two entry points, one component.**
    A `Settings` section and a sheet layered over the editor dialog, opened by a trailing `⚙` Item.
    The in-editor path **must not navigate**: the editor may hold an unsaved draft, and routing away would either destroy it or force the `ensureNoteId` race that Task 4 of the same slice refused for archive and trash.
    The sheet mount also gives live preview against the real note for free.
11. **The settings editor drills in.**
    Top screen is the eight or so family rows; tapping one pushes into a flat list of its buttons.
    Every list is single-level, so nested drag-and-drop never exists.
12. **Drag-reorder is core, not a fast-follow.**
    Order is half of what a Layout is.
    `@dnd-kit/sortable` with its keyboard sensor, drag handle as the only drag origin, no parallel up/down buttons.
13. **The registry owns the id and presentation of an editor action; behaviour stays per surface.**
    `SLASH_ITEMS` keeps its own `run` and `keywords` but keys them by registry id and drops its duplicate icon and label.
14. **Two customisable surfaces, deliberately not three.**
    The editor toolbar (full model) and quick capture (a plain ordered list, no families, no Width Classes).
    The card foot rail is **not** customisable: it is per-State, and letting a user remove Restore leaves a trashed note with no way back.
    The sidebar is a plausible later candidate and is out of scope.

## Consequences

- **Ids become persisted user data.** After this ships, renaming a button id is a migration, which is why the ids are cleaned up (`Mathematics` → `math`, `backgroundColor` → `highlight`) in the same change that introduces the registry.
- **Absence must mean "new", not "hidden".** Membership-equals-visible would mean any button shipped after a user first opens this screen is invisible to them forever. Hidden is therefore recorded explicitly, and reconciliation appends unknown registry ids at their default position.
- **`hideOnMobile` is deleted.** Which buttons a phone shows stops being a developer decision in extension code and becomes the Compact preset.
- **A button cannot leave its family.** Bold cannot sit between H1 and H2. This is a deliberate reduction in freedom that preserves the grouping a toolbar needs to stay readable, and it is what lets the settings editor drill in instead of doing nested drag-and-drop.
- The registry becomes the single id and presentation source for an editor action, so the slash menu projects over the same ids instead of maintaining a third parallel list.
