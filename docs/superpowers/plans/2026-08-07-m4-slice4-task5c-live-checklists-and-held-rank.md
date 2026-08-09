# M4 Slice 4 Task 5c - Live card checklists, sinking as presentation, held feed rank

**Status:** **complete** (2026-08-07). All six steps done and verified in a browser; the measured results are recorded per step.

**Goal:** Make a Checklist usable from the card without opening the note, make sinking work on both surfaces and actually animate, and stop the wall re-ordering itself under the user's hand.

**Depends on:** Task 5b (the checklist tap targets, drag-reorder and `CheckedSink` this replaces), Slice 1's `PreferencesProvider`, Task 6's `DocumentPreferences` seam.

**Decisions:** [ADR 0012](../../adr/0012-feed-rank-is-held-membership-is-live.md) (held rank), [ADR 0013](../../adr/0013-checklist-sinking-is-presentation-not-storage.md) (sinking is presentation).
Vocabulary is in [`CONTEXT.md`](../../../CONTEXT.md): **Sinking** under *Core entities*, and **Feed** / **Sort** / **Membership** / **Rank** under *The feed*.

**Cross-cutting rules:** new strings ship `en` + `cs` (`translations.test.ts` gates it).
Reduced motion is a hard killswitch.
Land tests with each step.

## Context

The starting state, read from the code rather than assumed.

- **The card's checkbox is broken, not inert.**
  `NoteCard.tsx:149` sets `[&_input]:pointer-events-none` and comments that a preview's checkbox is a picture.
  TipTap's `renderHTML` emits `<li data-type="taskItem" data-checked><label><input type="checkbox"><span></span></label><div>…</div></li>`, and clicking the label's `<span>` activates the input through label-for semantics regardless of `pointer-events`.
  So a tap flips the box in the DOM, writes nothing, bubbles to the card, and opens an editor showing the unchanged state.
- **Sinking exists, is off by default, and cannot reach the card.**
  `CheckedSink.ts` is an `appendTransaction` plugin that moves the item in the ProseMirror document.
  The card has no ProseMirror instance.
- **There is no strike-through and no divider anywhere.**
  `globals.css:780-847` styles task lists and never mentions `data-checked="true"`.
  Nothing to fix; it was never written.
- **The feed re-ranks on every write.**
  `useNoteFeed.ts:145` sorts inside a `useMemo` over a `useLiveQuery`, the default sort is `updated desc`, and `updateNote` bumps `updatedAt` unconditionally.
  Two shipped defects follow: recolouring a card (`NoteCard.tsx:166`) sends it to the top, and the editor's debounced autosave (`NoteEditorDialog.tsx:120`) reflows the wall behind the open modal.
- **The touch floor is `.tiptap`-only on purpose.**
  `globals.css:832` justifies it: *"a card is a preview, and 44px rows would let three items eat a whole card."*
  That reasoning inverts once card boxes are controls.
- **`PREFERENCES_VERSION` is `1` and `version` is `z.literal(...)`.**
  A naive bump makes every stored blob fail validation, and `parsePreferences` falls back to `DEFAULT_PREFERENCES` - wiping the user's toolbar, density, reduced motion and colour-blind setting.
  Any migration has to run *before* the schema sees the blob.

Two things confirmed from `@tiptap/extension-list` source rather than guessed:

- `renderHTML` really does serialise the `label`/`input`/`span` into the stored Body, so the card renders a real, natively-clickable input.
- The node view's `update()` does `listItem.dataset.checked = …` and returns the same `dom`, so **ProseMirror does not recreate the `li` on a toggle**.
  FLIP in the editor gets true node identity.

## Step 0 - Two browser checks, before any code - **done** (2026-08-07)

Both could invalidate a decision, so they came first.
Measured in Chrome, in a standalone CSS harness and then against the running app.

- [x] **`-webkit-line-clamp` against a flex `ul`** - **the clamp was already broken, before any of this work.**

      Measured on a real card carrying a 12-item checklist: prose 313px, **12 of 12 rows fully visible**, card 415px. The computed `-webkit-line-clamp` really is `6`; it simply does nothing.

      The cause is not the flex `ul` this plan adds. It is `li { display: flex }`, which **already ships** at `globals.css:794`. Isolated in the harness, at a container whose clamped height is 141px:

      | `li` display | height | clamps |
      | --- | --- | --- |
      | plain text (no list) | 141px | yes |
      | 12 paragraphs | 141px | yes |
      | `list-item` | 141px | yes |
      | `block` | 141px | yes |
      | **`flex`** (what ships) | 280px | **no** |
      | `flex` inside a flex `ul` (this plan) | 280px | no |
      | `grid` | 559px | no |

      Confirmed on the live card: forcing the rows back to `display: list-item` collapsed it from 313px to 131px immediately. So this plan's flex `ul` costs nothing that was not already lost - the card's six-line clamp has been inert for checklists since Task 5b rescoped the task-list CSS from `.tiptap` to `.prose`, which is what gave the card its flex rows in the first place.

      `display: -webkit-box` is a red herring: the container computes `flow-root` whatever is set, inline styles included, yet clamps correctly the moment the rows stop being flex.

      **Consequence:** Step 5 takes the fallback this step named. A `max-height` plus `overflow: hidden` caps the card regardless of `display` (measured: 122px), and it is what the coarse-pointer three-row cap is expressed in. Restoring the clamp by un-flexing the row is not available - `list-item`, `block` and the float variant all put the checkbox on its own line with the text beneath it, which is the exact defect Task 5b fixed.

- [x] **Dragging a text selection across the seam** - **odd, not unusable. CSS `order` stands.**

      Selecting the two *visually* adjacent rows either side of the divider (`alpha` → `charlie`) produces a DOM range that also covers `bravo`, which sits below the divider. On screen: two highlighted rows, the divider, one highlighted row, then one unhighlighted row. The selection reads as discontiguous.

      Copied text comes out in DOM order, which is the authored order, so the clipboard is right even when the highlight looks strange. Selecting the whole list is completely correct.

      Judged acceptable: the anomaly needs a multi-row drag across the seam to provoke, it never loses or corrupts anything, and the fallback (ADR 0013's rejected "card sinks, editor shows true order") costs the feature on the surface where most ticking happens. Revisit only if it is reported.

## Step 1 - Held feed rank - **done** (2026-08-07)

Ships first and alone.
It is not checklist-specific, it independently fixes the two defects above, and every later step lands on a wall that stays still.

- [x] `src/lib/feed-rank.ts` - `mergeHeldOrder(fresh: Note[], held: string[]): Note[]`, pure.
      Incumbents keep their held order; a note absent from `held` is a newcomer and is emitted at its **fresh-order position relative to the incumbents**, not simply at the front.
      Front-insertion would be wrong under `title asc`, where a new note called "Zebra" belongs last.
      Held ids that are no longer present are dropped, which is how membership stays live.
- [x] `useNoteFeed`: hold the order across live-query refires.

      ```ts
      const heldRef = useRef<{ key: string; ids: string[] } | null>(null);
      const rankKey = `${scope.state}|${scope.tagId ?? ''}|${trimmed}|${sort}|${dir}|${tagKey}|${visEpoch}`;

      const notes = useMemo(() => {
        const fresh = /* today's matched + filtered list */;
        const held = heldRef.current?.key === rankKey ? heldRef.current.ids : null;
        return floatPinned(held ? mergeHeldOrder(fresh, held) : fresh);
      }, [entries, index, trimmed, sort, dir, allowedIds, rankKey]);

      useEffect(() => { heldRef.current = { key: rankKey, ids: notes.map((n) => n.id) }; }, [notes, rankKey]);
      ```

      The staleness check happens **inside the memo at read time**, and the ref is written only from an effect.
      This is deliberate: the repo's pre-commit ESLint rejects ref writes during render, and a reset effect would run *after* the memo it needs to precede.
      Keying the held order by the params it was captured under gets the ordering right without either.
- [x] `visEpoch` is a counter bumped from a `visibilitychange` listener when the document becomes visible, folded into `rankKey`.
      Mount needs no special case: `heldRef.current` starts `null`, so the first render adopts the fresh order.
- [x] `floatPinned` runs **after** the merge, unchanged, so pinning stays live per ADR 0012's exception.
- [x] Tests (`feed-rank.test.ts`): incumbents hold order across a refire; a departed note drops out; a newcomer lands in fresh-order position under `updated desc` **and** under `title asc`; a params change adopts fresh order; a pinned note floats regardless of held rank.
- [x] Tests (`useNoteFeed.test.ts`): an `updateNote` that bumps `updatedAt` does not move the note; a sort change does; a created note appears immediately.

**Manual gate:** recolour a card mid-wall and confirm it stays put; edit a note in the dialog on desktop and confirm the wall behind it does not move; switch tabs and back and confirm it re-ranks with the existing spring rather than teleporting.

## Step 2 - Preference: default, migration, copy - **done** (2026-08-07)

- [x] `PREFERENCES_VERSION` → `2`, and `version` stays `z.literal(PREFERENCES_VERSION)`.
- [x] A `migrate(raw)` step in front of the schema inside `parsePreferences`:

      ```ts
      function migrate(raw: unknown): unknown {
        if (!raw || typeof raw !== 'object') return raw;
        const blob = raw as Record<string, unknown>;
        // v1 → v2 (ADR 0013): sinking stopped rewriting the stored order, so the
        // reason it defaulted off is gone. Forced rather than defaulted, because
        // `setPreference` persists the whole parsed blob - every existing user
        // already has `sinkCheckedItems: false` on disk and a changed default
        // would reach none of them.
        if (blob.version === 1) return { ...blob, version: 2, sinkCheckedItems: true };
        return blob;
      }
      ```

      This is the mechanism `PREFERENCES_VERSION`'s own doc comment describes ("handle the old shape in `parsePreferences`"), and it is the only one available: a bare bump fails `z.literal` and takes the whole blob down.
- [x] `sinkCheckedItems` default → `true`, and its doc comment rewritten.
      The current one argues for `false` on grounds ADR 0013 removed.
- [x] **The migration does not write.** It runs on every read until the next `setPreference` persists `version: 2`.
      That is intentional and matches the existing contract: *"a mere read never destroys data we might want to inspect."*
      It is idempotent, so re-running costs nothing.
- [x] **Accepted loss, recorded here rather than discovered later:** a user who turned sinking on and then deliberately off, in the two days the setting has existed, is opted back in.
      There is no way to tell that `false` from the default `false`, and the behaviour is no longer destructive, so being opted in is benign.
- [x] `settings.sinkCheckedItems.description` rewritten in `en` and `cs`: it currently says items "drop to the bottom", which is now a claim about storage that is false.
      Say they are *shown* at the bottom and that the typed order is never changed.
- [x] `DocumentPreferences`: stamp `data-sink-checked` on `<html>`.
      It passes the documented test for belonging there - the stylesheet needs the value and JS cannot hand it over.
- [x] Tests: a v1 blob migrates with its toolbar, density, colour-blind and reduced-motion intact; a v2 blob with `sinkCheckedItems: false` is left alone; a corrupt blob still yields defaults; `DocumentPreferences` stamps and unstamps the attribute.

**Hydration note:** `PreferencesProvider` hydrates from Dexie a frame after first paint, so the attribute is present from the first frame for everyone (the new default is `true`).
Users who turn it off get one frame of sunk order on a cold load, the same cost density and reduced motion already pay.

## Step 3 - Sinking becomes CSS - **done** (2026-08-07)

- [x] **Delete** `CheckedSink`'s sinking half: `sinkTransaction`, `childStart`, the `SINK_META` round-trip guard, the extension's registration in `build.ts:84`, its export in `TaskList/index.ts`, and the `sinkCheckedItemsRef` plumbing at `editor.tsx:218-241`.
      **Keep `findToggledItem`.** Step 4 needs exactly that diff to know when to animate, it is already written and tested, and its doc comment explains a non-obvious choice (compare documents, not steps) that would otherwise be rediscovered.
      Move it to the new extension in Step 4 and carry its tests with it.
- [x] `globals.css`, in the existing `.prose ul[data-type="taskList"]` block, gated on `[data-sink-checked]`:

      ```css
      ul[data-type="taskList"] { display: flex; flex-direction: column; }
      ul[data-type="taskList"] > li                      { order: -1; }
      ul[data-type="taskList"] > li[data-checked="true"] { order:  1; }
      ul[data-type="taskList"]::after { content: ''; order: 0; border-top: 1px solid var(--border); }
      ```

      The child combinator is load-bearing: without it a nested checklist's items trigger the parent list's rules.
- [x] Hide the divider for an all-checked or all-unchecked list with `:not(:has(> li[data-checked="true"]))` and `:not(:has(> li[data-checked="false"]))`.
      Fade it in via `opacity` rather than `display`, since `:has()` toggling opacity is transitionable and `display` is not.
- [x] Checked rows: `line-through` immediately, `color` transitioning to `--muted-foreground` over ~150ms.
      **Do not animate the strike.**
      `text-decoration` is not animatable, and a gradient fake would draw a line across the text at the same moment the row glides down.
- [x] Comment the whole block with *why* the divider is a pseudo-element at `order: 0` - that sibling combinators read DOM order and no selector can express "first element with `order: 1`".
      This is the single most likely thing for a future reader to "simplify" into a `+` selector.
- [x] Tests: a component test asserting `data-sink-checked` gates the rules is not possible in jsdom (no layout), so this step's gate is manual.
      What *is* testable and should be: `DocumentPreferences` (Step 2) and the absence of `CheckedSink` from the built extension list.

**Manual gate:** tick an item in the editor and on a card and confirm both sink, both draw one divider, and a nested checklist sinks within its own sub-list rather than past its parent.
Turn the preference off and confirm nothing sinks and no divider appears anywhere.

## Step 4 - The FLIP helper and the editor - **done** (2026-08-07)

- [x] `src/lib/flip-rows.ts` - `captureRows(ul)` returns rects by index; `playRows(ul, before)` re-measures, applies the inverse `translateY`, and plays to zero with `Element.animate()`.
      **Matched by index, not identity.**
      Only `data-checked` changes, so the k-th `li` before and after is the same logical item - which is what lets one helper serve the editor (nodes survive) and the card (`innerHTML` destroys them).
      No-ops when `useReducedMotion()` is true, per DESIGN.md's hard killswitch.
      WAAPI rather than Motion: this is a one-shot inverse transform, and `motionProvider` loads `domAnimation` lazily, so pulling imperative Motion in would grow that bundle for nothing.
- [x] `ChecklistFlip` extension replacing `CheckedSink`: `findToggledItem` (carried over) fires in `appendTransaction`, which runs **before** the view updates the DOM, so that is where `captureRows` reads the old geometry.
      The plugin's `view().update()` runs after, and plays.
      `appendTransaction` returns `null` - it mutates nothing and exists only for its timing.
- [x] Tests: `flip-rows.test.ts` for the pure measurement/inversion arithmetic against stubbed `getBoundingClientRect` (the `dnd-kit` precedent - stub the rows, restore the spy).
      `findToggledItem`'s existing tests carry over unchanged.
      The animation playback itself is not unit-testable in jsdom and is a manual gate.

**Manual gate:** tick an item three rows up a long list and confirm the row glides down while everything it passes slides up, with no overshoot (DESIGN.md: nothing in the system bounces).
Confirm reduced motion makes it instant.

## Step 5 - Live card checkboxes - **done** (2026-08-07)

- [x] `src/lib/checklist.ts` - `toggleChecklistItem(html, index, expected): string | null`, pure, `DOMParser`-based.
      Writes **both** `data-checked` on the `li` and the `checked` attribute on its `input`: the first is what TipTap parses back, the second is what paints the card.
      Returns `null` when the index is missing or the item is already in the target state, which is the stale-write guard.
      Index is a safe key because `stripAttachmentNodes` only removes `img`/`video`/`audio`/`a`/`excalidraw-drawing` and never an `li`, so the rendered DOM index equals the stored index.
- [x] `NoteCard`: **remove** `[&_input]:pointer-events-none` and its comment, which now asserts the opposite of the truth.
- [x] One delegated listener on the `NoteBody` container - the content is `innerHTML`, so per-item handlers do not exist.
      It matches a click inside `li > label`, calls `stopPropagation` (or the card opens) and `preventDefault` (so we own both attributes rather than racing the native toggle), patches the DOM, plays FLIP, then persists.
- [x] Optimistic rendering without fighting the echo:
      `NoteCard` holds `pendingBody`, sets it to the exact string `toggleChecklistItem` produced, and passes `pendingBody ?? prose` to `NoteBody`.
      When the live query echoes, the recomputed `prose` **equals** `pendingBody` by value, so the memo's shallow compare skips the re-render and the patched nodes survive the animation.
      Without this the `innerHTML` rebuild lands mid-flight and truncates it.
      Clear `pendingBody` once `prose === pendingBody`; on a failed write clear it too, and the next render restores the true html.
- [x] **No undo toast**, deliberately diverging from every other card action's `withUndo` wrapper.
      The checkbox is its own undo, and a toast per tick would be noise on a shopping list.
      Comment it, or someone will "fix" the inconsistency.
- [x] 44px Touch Rule on the card (ADR 0013): extend both halves of the `@media (pointer: coarse)` block from `.tiptap` to `.prose`, and rewrite the comment at `globals.css:832`, whose stated reason no longer holds.
- [x] Clamp becomes pointer-dependent: six lines on a fine pointer, three on a coarse one, so a checklist card lands near 132px rather than 264px.
      Because checked items sink, those three rows are always the three things most likely to be next.
- [x] Keyboard needs no work and should be confirmed rather than assumed: the input is already in the tab order, and `NoteCard.tsx:89`'s `e.target !== e.currentTarget` guard already stops Space from also opening the note.
- [x] Tests: `checklist.test.ts` (both attributes written; index out of range; already-in-state; a nested checklist's items counted in document order; an attachment node in the body not shifting the index).
      `NoteCard.test.tsx` (a label click toggles and does **not** call `onSelect`; a click on the row's text *does* open the note; a failed write rolls the optimistic state back).

**Manual gate:** on a phone, tick three consecutive items without the card moving and without a tap landing on the wrong row.
On desktop, tick from the card and confirm the editor opens showing the same state.

## Two deviations from the plan, both found while building

**The optimistic DOM patch was dropped.** Step 5 called for patching `data-checked` on the spot and persisting afterwards, so the first frame of movement would land within ~16ms.
It cannot work as described: handing `NoteBody` an optimistic `html` changes the prop, which re-runs `dangerouslySetInnerHTML`, which replaces every node and destroys the animation it was meant to protect.
Passing the old value instead does not help, because the live-query echo arrives in 5-30ms and rebuilds the markup mid-flight anyway.

The rebuild is therefore unavoidable, and the FLIP runs *after* it, from a `useLayoutEffect` keyed on the body markup - which is exactly what matching rows by index rather than identity was for.
Direct manipulation is still answered on the same frame, by not calling `preventDefault`: the native checkbox flips itself the instant it is clicked, and only the row's *travel* waits for the round trip.
Measured in the browser: the ticked row animated 102.75px while its three neighbours each moved 29.66px, all at 200ms.

**A newly checked item lands in its authored position within the checked block, not at the bottom of it.**
`order: 1` ties every checked row, and DOM order breaks the tie - so the checked block always reads in the order the user typed.
The old `CheckedSink` stacked by tick time instead, because it had somewhere to put that information; a presentation rule does not, and storing a tick time to recover it would be re-introducing exactly the write ADR 0013 removed.
The result is arguably better - the block is stable and predictable rather than shuffling on every tick - but it is a visible behaviour change and is recorded here rather than left to be discovered.

## Verification

Green on `pnpm test`, `pnpm build` (typecheck) and `pnpm check:ci` after every step.

Manual gates, collected - all need a real browser, none are reachable from jsdom:

1. Step 0's two checks, before anything else.
2. Recolour and dialog-autosave no longer move a card; tab-return re-ranks.
3. Both surfaces sink identically; one divider; nested lists sink within themselves; the preference still turns it all off.
4. The glide has no overshoot; reduced motion kills it.
5. Three consecutive card ticks on a phone, no card movement, no mis-taps.
6. A v1 preferences blob keeps its toolbar, density and reduced motion through the migration.

## Out of scope

- **M5 sync and rank.** ADR 0012 says an externally-arriving change does not re-rank until the user looks away. Whether that is right is an M5 question.
- **Manual drag-reorder of checklist items.** Removed entirely (2026-08-07) rather than left as a known limit. It was mouse-only from the start, and once sinking became a CSS `order` rule a drag moved the item in the document while the visual order stayed governed by `order` - so on a checked item it read as doing nothing at all. Reordering *unchecked* items by priority is a real capability this gives up; if it comes back it needs a touch-capable design, not the `mousemove`-positioned grip.
- **Editing anything but checkboxes from the card.** Text, labels and structure still require opening the note.
