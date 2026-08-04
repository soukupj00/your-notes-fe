# Toolbar Items and Families over a flat button list

The customisable toolbar was planned as `prefs.toolbar: string[]` of TipTap extension names, but extension names are not buttons (`heading` yields three, `textAlign` three, `history` two), so that shape cannot express "H1 alone", "all three headings" or "one heading dropdown".
We introduce a **Toolbar Item** registry with a stable id space of its own, group Items into **Families** that are shown either expanded or collapsed, and store one **Toolbar Layout** per **Width Class** as structured per-family records rather than a flat array of ids.

## Considered options

- **Flat `string[]` of extension names.** Cheapest and matches the original plan, but cannot address a single heading level or a collapsed group, and re-admits the invalid state "a collapsed menu plus its own leaves on the same bar" that the family model makes unrepresentable.
- **One ranked list with measured mobile overflow.** One thing to configure and it deletes the developer-owned `hideOnMobile` layout, but it makes "off" and "ranked low" different states that both need reaching, and requires a `ResizeObserver` on a bar that sits above a viewport-resizing keyboard.
- **Two Layouts of structured family records** (chosen). Two things to configure, and the settings UI needs a Width Class toggle, but each Layout is a direct description of one bar with no measurement anywhere.

## Consequences

- **Ids become persisted user data.** After this ships, renaming a button id is a migration, which is why the ids are cleaned up (`Mathematics` → `math`, `backgroundColor` → `highlight`) in the same change that introduces the registry.
- **Absence must mean "new", not "hidden".** Membership-equals-visible would mean any button shipped after a user first opens this screen is invisible to them forever. Hidden is therefore recorded explicitly, and reconciliation appends unknown registry ids at their default position.
- **`hideOnMobile` is deleted.** Which buttons a phone shows stops being a developer decision in extension code and becomes the Compact preset.
- **A button cannot leave its family.** Bold cannot sit between H1 and H2. This is a deliberate reduction in freedom that preserves the grouping a toolbar needs to stay readable, and it is what lets the settings editor drill in instead of doing nested drag-and-drop.
- The registry becomes the single id and presentation source for an editor action, so the slash menu projects over the same ids instead of maintaining a third parallel list.
