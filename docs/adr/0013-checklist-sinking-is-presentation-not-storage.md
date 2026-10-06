# 0013 — Checklist sinking is presentation, not storage

- Status: Accepted
- Date: 2026-08-07
- Supersedes the implementation decided in Task 5b of the M4 Slice 4 plan, identity and motion (2026-08-05).

## Context

A Checklist has two surfaces, and they render from different things.
The Editor renders a ProseMirror document; the card renders the stored Body HTML through `NoteBody`'s `dangerouslySetInnerHTML`.
Any rule about how a Checklist looks has to hold on both, or the same list reads two ways depending on where you look at it.

Task 5b shipped sinking as `CheckedSink.ts`, an `appendTransaction` plugin that physically **moves the toggled item** in the document.
That works in the Editor and cannot reach the card at all, because the card has no ProseMirror instance.
It was also gated off by default, with an explicit justification: *"a ranked list of options wants its order left exactly where the user put it, and silently rewriting that order would be the app losing the user's work."*

Separately, the card's checkboxes were made inert with `[&_input]:pointer-events-none` (`NoteCard.tsx`), commented as *"a preview's checkboxes are a picture of the note, not a control"*.
**That does not work.** TipTap's `renderHTML` (`@tiptap/extension-list`) emits `<li data-type="taskItem" data-checked><label><input type="checkbox"><span></span></label><div>…</div></li>`, and clicking the label's `<span>` activates the input through label-for semantics regardless of the input's `pointer-events`.
So a tap on a card checkbox flipped the box in the DOM, wrote nothing, bubbled to the card, and opened an editor showing the unchanged state.
The control was not inert; it was broken.

We want card checkboxes to be genuinely live, which means the sinking rule now has to hold on a surface the plugin cannot reach.

## Decision

**Sinking is a way of showing a Checklist, never a way of storing one.**
The Body always holds the order the user typed.

Both surfaces present checked items last via CSS `order` on a flex column, in one `.prose`-scoped rule that the Editor and the card already share:

```css
ul[data-type="taskList"] { display: flex; flex-direction: column; }
ul[data-type="taskList"] > li                      { order: -1; }
ul[data-type="taskList"] > li[data-checked="true"] { order:  1; }
ul[data-type="taskList"]::after { content: ''; order: 0; border-top: 1px solid var(--border); }
```

`CheckedSink.ts` and its test are deleted, along with its registration in `build.ts` and its ref plumbing in `editor.tsx`.

Three parts of this are worth recording, because each is surprising in isolation.

**The divider is a pseudo-element parked at `order: 0`.**
Sibling combinators read *DOM* order, and `order` changes only *visual* order, so `li[data-checked="false"] + li[data-checked="true"]` would draw the line in the wrong place.
No CSS selector can express "the first element with `order: 1`".
A pseudo-element on the `ul` is itself a flex item and can take an `order`, so it can be parked exactly at the seam.
This adds nothing to the stored Body and is safe inside `contenteditable`, since a pseudo-element cannot be selected or deleted and ProseMirror never sees it.
`:has(> li[data-checked="true"])` hides it for an all-checked or all-unchecked list; the child combinator is load-bearing, or a nested checklist's items would trigger the parent's divider.

**DOM order and visual order deliberately disagree inside a `contenteditable`.**
Vertical caret movement is browser-visual, so arrow keys stay correct.
Copy, paste and serialisation use DOM order, which is correct by definition here since DOM order *is* the authored order.
The one genuine oddity is dragging a text selection across the seam, where the DOM range spans items that are not visually contiguous.
Accepted, and to be confirmed in a real browser before the rule is written.

**Unchecking is exact, not approximate.**
Because nothing was ever moved, an item returns to precisely the position it was authored in.
The old plugin could only float it back to the *top of the checked block*, which was a heuristic standing in for information it had thrown away.

## Considered options

- **Keep the document mutation and re-implement it for the card.**
  What you see is what is stored, so a raw-HTML export or a future sync peer carries the order.
  Rejected: the same rule would live in two places written against two different representations (a ProseMirror document and an HTML string), which is precisely the drift this codebase has been removing.
  It also keeps the destructive property that forced the preference off by default.

- **Keep the mutation, but move the sort into one pure function over an HTML string that both surfaces call.**
  A single source of truth for the ordering.
  Rejected: the Editor would have to serialise, sort and reparse on every tick, disturbing the caret and polluting the undo history, and it still rewrites the user's authored order.

- **Card sinks, Editor shows true order.**
  Zero `contenteditable` risk.
  Rejected: ticking in the Editor is where most ticking happens, so the feature would be missing from the surface that needs it most, and the two surfaces would show different orders for the same list.

- **Leave card checkboxes inert (fix the label leak by disabling the input properly).**
  Rejected as the reading of the original intent that ages worst.
  A checkbox that looks like a checkbox and refuses to tick is a worse preview than no checkbox, and the whole point of a note wall is acting on notes without opening them.

## Consequences

- **`sinkCheckedItems` defaults to `true`.**
  The justification for `false` was that sinking destroyed the user's order; it no longer does.
  The preference survives for the case where sequence *is* the content (recipe steps, ranked options), which is real but a minority.
  This needs a migration, not just a schema default: `setPreference` writes the whole parsed blob, so every existing user who has ever changed any setting already has `sinkCheckedItems: false` on disk.
- **The whole CSS block is gated on the preference** via a `data-sink-checked` attribute stamped onto `<html>` by `DocumentPreferences`, which matches the documented test for belonging there ("whether the stylesheet needs the value").
- **The card's checkboxes become controls, so the 44px Touch Rule reaches the card - but as a hit box, not as a row height.**
  The rule was first applied to the card in full, both halves, and that was wrong in a way only the screen showed.
  Measured on a 390px viewport: a row's text is 20px, so the 44px floor left 24px of dead space per row and a three-row checklist spent **72px of a 216px card** on nothing.
  A card is the one surface where vertical space is genuinely scarce, and the old `.tiptap`-only scoping had said so; what was wrong with that justification was not its reasoning but its conclusion.

  So the rule keeps its hit box and drops its floor.
  The target is 44px wide and as tall as its own row, anchored to the row rather than centred on the checkbox - which means consecutive targets still tile exactly rather than overlapping, and tiling is the whole thing the floor was there to guarantee.
  Width is the axis both surfaces can afford; height is the one neither can.

  This was first applied to the card alone, on the theory that an editor row is a line being written in and so was already paying for its height.
  It was not: a phone-width editor read as double-spaced for the same reason, and a checklist should not feel like a different control depending on whether you are reading it or writing it.
  **One treatment, both surfaces.**
  Card rows fell from 44px to 22px and editor rows from 44px to 26px; the card itself fell from 216px to 188px while showing *more* rows, not fewer.
  Verified by tapping: with the visible checkbox ending 19px into the row, a tap at x=38 on the row's bottom edge still resolves to that row's label and toggles it.

- **A capped card body fades rather than cutting.**
  `max-height` ends the body in a hard slice through whatever glyph the limit lands on, which reads as a rendering fault rather than as "there is more".
  A `mask-image` gradient dissolves the text instead, applied only when `NoteCard` measures a real overflow.
  A mask rather than a gradient painted over the top, because the card surface is themed and re-tinted per note colour, so an overlay would have to know that colour to blend into it; dissolving the text is colour-agnostic and correct on every identity in both themes.
- The card writes **both** `data-checked` on the `li` and `checked` on the `input`.
  `data-checked` is what TipTap parses back; `checked` is what paints the card.
  Writing one and not the other makes the two surfaces disagree.
- **The checked block reads in authored order, not tick order.**
  `order: 1` ties every checked row and DOM order breaks the tie, so a newly ticked item lands where it was written rather than at the bottom of the block.
  The old plugin stacked by tick time because it had a document to record that in; a presentation rule has nowhere to put it, and adding a stored tick time to recover the old behaviour would re-introduce the write this decision removes.
  The block is stable across ticks as a result, which is the better trade, but it is a visible behaviour change from Task 5b.
- A tick is direct manipulation, and it is answered on the same frame by *not* calling `preventDefault`: the native checkbox flips itself immediately.
  Only the row's travel waits for the Dexie round-trip, because the live-query echo re-runs `dangerouslySetInnerHTML` and replaces every node - so an optimistic DOM patch would have its animation destroyed by the very rebuild it was racing.
  The FLIP therefore runs after the rebuild, from a layout effect, which is what index correspondence exists to make possible.
- The travel animation is FLIP by **index correspondence**, not node identity, which is what lets one helper serve both surfaces.
  The Editor keeps its node (`update()` sets `listItem.dataset.checked` in place and returns the same `dom`), while the card replaces every node via `innerHTML` - but since only an attribute changed, the k-th `li` before and after is the same logical item.
- The strike-through is not animated.
  `text-decoration` is not animatable, and faking it with a scaling gradient would draw a line across the text at the same moment the row glides downward: two animations competing for one eye.
  `line-through` lands instantly while `color` transitions to `--muted-foreground`, so the row recedes as it falls.
- Vocabulary lands in `CONTEXT.md` as **Sinking**, under *Core entities*.
