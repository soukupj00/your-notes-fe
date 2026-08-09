# 0012 — Feed rank is held, membership is live

- Status: Accepted
- Date: 2026-08-07

## Context

`useNoteFeed` derives the feed inside a `useMemo` over a Dexie `useLiveQuery`, so **any** write to the `notes` table re-runs the comparator and re-orders the wall on the next frame.
The default sort is `updated desc` (`note-search-params.ts:37`), and `updateNote` bumps `updatedAt` unconditionally (`useNoteActions.ts:82`).

Those two facts together mean the feed re-ranks itself as a direct consequence of the user's own in-place edits.
This already ships, in two places, and was not noticed because both are easy to misread as intentional:

- **Recolouring a card sends it to the top.** `NoteCard.tsx:166` calls `updateNote(note.id, { color })`.
- **The wall reflows behind an open editor.** `NoteEditorDialog.tsx:120` autosaves on a debounce, so on desktop the card has moved by the time the modal closes.

It also blocks a third thing outright.
Ticking a checkbox on a card ([ADR 0013](./0013-checklist-sinking-is-presentation-not-storage.md)) writes the Body, which sends the card to position 0, slides a different card under the user's thumb, and lands the next tap on the wrong note.
The failure compounds: each edit makes the next edit harder, because the target keeps moving.
A feature for editing a card in place is worthless on a wall that relocates the card in response.

The masonry wall's distinctive value is that it is navigated *spatially* - "groceries is third down on the left".
Re-ranking on every edit destroys exactly the thing masonry is good at.

## Decision

**The feed's membership is live; its rank is held.**

- **Membership** - which Notes the feed contains - is always live.
  A Note that stops qualifying leaves at once (trashing, archiving, filtering out of a search), and one that starts qualifying arrives at once (creation, restore, matching a query).
  Nothing here changes.
- **Rank** - a Note's place within the feed - is held.
  A Note already on screen does not change place because of something the user just did to it.

Rank is recomputed only when the user is not watching:

1. On mount, which covers every route change between feeds.
2. On search-param change (`q`, `sort`, `dir`, `tags`) - the user asked for a different arrangement, so they get one.
3. On `visibilitychange` back to visible, which covers backgrounding the PWA and switching tabs.

**Pinning is the one exception**, and it has to be: DESIGN.md's Direct-Manipulation Rule is written specifically about pinning, and moving the card *is* the action being requested.
This costs nothing structurally, because `floatPinned` (`useNoteFeed.ts:59`) already runs as a separate partition step from the comparator - the pinned/unpinned split stays live while rank *within* each partition is held.

A Note that is not in the held rank map (newly created, newly restored, newly matching a query) is ranked normally by the comparator, so creation still puts a note at the top instantly.
"Held" applies to notes already on screen, never to the array as a whole.

## Considered options

- **Do not bump `updatedAt` for in-place edits.**
  A one-line change with no feed rework: ticking is "using" the note, not changing it.
  Rejected because the Body genuinely changed and the model would then deny it.
  M5 Sync and the Offline Mutation Queue are the eventual consumers of `updatedAt`, and a protocol keyed on it would silently drop every tick.
  Trading a UI problem for silent data loss on sync is not a trade.
  It also requires a taxonomy - somebody has to keep deciding which edits "count" - and the answers would drift between call sites.

- **Let the wall reflow; the spring already exists.**
  Zero new machinery, fully honest data, and the movement arguably reads as "this is the note you are working on".
  Rejected on the compounding failure above, and because it contradicts DESIGN.md's stated motion values ("calm motion, nothing that draws the eye away from text").
  A whole wall lurching because a checkbox was ticked is precisely what that sentence forbids.

- **Re-rank on an idle timer as well.**
  Keeps the wall fresher without moving under an active hand.
  Rejected: a card would move while the user is reading it and simply not touching anything, which is the exact surprise this rule exists to prevent.

- **Re-rank on mount and search-param change only, with no visibility listener.**
  The least machinery.
  Rejected because a PWA tab stays open for days, so the staleness is unbounded; the visibility listener costs a few lines and bounds it at "since you last looked away".

## Consequences

- The order on screen no longer strictly matches the sort the URL claims.
  `?sort=updated&dir=desc` can show a top card that is not the most recently updated one.
  The discrepancy only ever involves notes the user just touched, and it self-corrects on return, but it is a real inconsistency and should be expected as a bug report.
- Two shipped defects are fixed as a side effect: the recolour jump and the reflow behind the open editor.
- Reflow is lost as an accidental "saved" signal.
  Every affected action must therefore carry its own local feedback: the undo toast for lifecycle actions, the swatch for colour, and the box/strike/sink for a tick.
- **M5 Sync interacts with this and is deliberately not settled here.**
  A Note changed on another device will appear or disappear correctly (membership is live) but will not re-rank until the user looks away and back.
  Whether an externally-arriving change should be allowed to re-rank immediately is an M5 question; the rule as written says no, and that is the more conservative default.
- On tab return the reflow uses the existing spring rather than teleporting, so the wall visibly settles and reads as "caught up".
- Vocabulary lands in `CONTEXT.md` under *The feed*: **Feed**, **Sort**, **Membership**, **Rank**.
  "Feed" was already load-bearing in the **Pinned** definition and had never been defined.
