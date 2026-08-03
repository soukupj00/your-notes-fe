# M4 Slice 4 - Identity & motion

**Status:** Task 1 complete; Task 1b complete except the touch-target and reflow-measurement gates; Task 2 palette complete including the colour-blind modifier, outstanding only on the two remaining popover mounts; Task 3 complete except dialog consolidation and `NoteFeed` tests; Task 4 complete except the editor's bottom action bar, which is next.

**Goal:** Give the app a distinctive "tactile paper" identity, add purposeful Motion animation, ship the full-card colour system, and make the toolbar user-customisable - turning a competent app into one that feels intentional and personal.

**Depends on:** Slices 1-3 (a consistent, complete surface to redesign; preferences store for toolbar/colour-blind/density; Motion pairs with the reduced-motion pref).

**Cross-cutting rule:** new strings ship `en` + `cs`. Respect `prefers-reduced-motion` everywhere.

## Context

Item 14: components currently look "straight out of the box" (shadcn defaults). North star chosen in grilling: **"Tactile paper"** - notes as physical cards you can lift. Several earlier decisions were made to feed this: full-card colour tints (Q9), a physical pin (Q15), Motion spring physics (Q17). **Build a prototype before touching production CSS.**

## Tasks

### Task 1 - Redesign prototype (validate first)

- [x] Build a prototype in the real app shell at `/prototype/identity` (dev-only route, redirects in prod). First pass explored "tactile paper" as three variants of one material system.
- [x] **Widened to five committed directions** (2026-07-29), because the first pass converged on warm paper - which is the aesthetic every model reaches for by default, not a choice. `stationery` is kept unchanged as the control; four new worlds replace the rest, each with its own palette, typefaces, geometry, material and ornament rather than being knob combinations of one system:
  - `enamel` - "Plate & ticket". Fired enamel plates, white keyline, monumental index numerals, ticket punch for pinned. Archivo / Archivo Black.
  - `riso` - "Duplicator". Two-ink overprint with deliberate misregistration and paper grain. Bricolage Grotesque / Work Sans.
  - `olivetti` - "Personal machine". Flat laminate colour fields, geometric marks, one quarter-round cut, zero shadow. Jost.
  - `videostore` - "Friday night". Dark-first, clamshell cases under a strip light, yellow reserved for state. Anton / Caveat / Barlow Semi Condensed.
- [x] Each direction renders a full fake app shell (topbar, rail with labels, capture bar, FAB, feed) rather than a lone card, so identity can be judged as an app.
- [x] Inspector reduced to the axes that stay meaningful in every world (theme, radius, featured colour, spring feel, card hover, button hover, reflow speed). Everything else is world-owned and locked, so comparisons are between decided designs rather than mixtures.
- [x] **Fixed the card-preview blur** seen on the 2% hover pop: the scale now runs on a dedicated `.proto-card-surface` layer carrying only background/border/shadow, while content never transforms. Chrome was rasterising text once and bitmap-stretching it. Locked by a test.
- [x] Typefaces are self-hosted `@fontsource` packages (no CDN - offline-first). Scoped to the dev-only chunk: main CSS has zero `@font-face`, and the prototype chunk is excluded from the PWA precache. **Prune the unused families once a direction wins.**
- [x] **Added a sixth world, `nightshift`** ("Day desk, night shop") - souki's directed merge of `stationery` and `videostore`. Warm parchment by day, a near-black room by night where each card's colour becomes a neon edge, chip and glow. One skeleton in both themes: 16px corners, one type system, one motion contract. Bricolage Grotesque / Work Sans.
- [x] **`nightshift` signed off** (2026-07-30) as the direction.
- [x] **`DESIGN.md` + `.impeccable/design.json` written** at repo root, from a measured browser pass over ~15 lab states (both themes, all five accents, all five card anatomies, touch, the narrow breakpoint, the script sampler, and the pin reflow) rather than from reasoning.

### Task 1b - Carry the direction into production

The design contract is [`DESIGN.md`](../../../DESIGN.md); its Named Rules are binding.
A production audit corrected the lab-only assumptions before implementation: production has no JS masonry hook, Motion dependency, or card pin control yet; its FAB is already a filled 56px Button; and the persisted palette has nine assignable keys plus default rather than the lab's six identities.
Reflow fixes therefore land with Task 3's packed feed, and the backed pin lands when Task 4 adds the card pin control.

- [x] **Day accent.** Replace the failing `oklch(58% 0.14 68)` with the resolved `oklch(54% 0.15 80)`. See *The Two-Constraint Rule* - an accent must clear 4.5:1 on its own text **and** 3:1 against the canvas, and brightening to yellow fails the second at 1.58:1.
- [ ] **Touch targets.** Audit the real production sites rather than porting the prototype list. Foundation + card + chrome gives card controls, colour swatches, search controls, and touch-mode shared chrome a real 44px box; checklist and later action surfaces remain with their owning tasks.
  Audited 2026-07-31: the shared coarse-pointer floor (`.touch-target` plus `[data-slot="button"]` and the sidebar slots) covers the navbar, search input, sort menu, theme toggle and the card foot rail; `NoteColorPicker` swatches are `size-11`; `CardPin` reaches 44px through its invisible `::before`; the FAB is 56px and the quick-capture and desktop-capture rows are `min-h-11`.
  **One site is still under the floor:** the remove `×` inside a `TagPills` pill (a bare `size-3` icon with no padding, editor-side only). It cannot take a 44px box the way `CardPin` does - at `gap-1` between pills, a 44px hit area would swallow both its own label and the neighbouring pill - so this needs a decision rather than a mechanical fix.
- [x] **FAB fill.** Production already uses the filled 56px primary Button; the implementation only replaces its generic elevation with the named token.
- [x] **Pin in front.** `CardPin` mounts as a child of the card rather than of the content layer, so it stacks above the media at `z-30`, and it carries its own filled disc - the card surface when idle, the accent when pinned.
  Verified on screen against a pure-white and a pure-black attachment in both themes.
  Its 44px touch box is *invisible padding* (a `::before` at `-5px`, which is what reaches 44px once the disc's 1px border is accounted for) rather than a 44px disc: a disc that large hangs into the first line of the note's own text on every card without media, which is the one thing this corner may not do.
- [ ] **Reflow responsiveness.** Task 3 replaced CSS columns with one attribute-registered, `ResizeObserver`-driven placement hook whose observer lifecycle is independent of `measure`. Layout-switch sampling now follows the overdamped spring without a corrective jump. The final click-to-first-frame gate stays open until Task 4 supplies the direct card pin control and its optimistic state.
  Task 4 has since shipped `CardPin`, so the gate is now *measurable* - but it is unmeasured, and there is no optimistic state: `pinNote` writes to Dexie and the feed re-renders off `useLiveQuery`, so the first frame waits on the IndexedDB round-trip. Measure before deciding whether optimism is needed.
- [x] **Wire the reflow transition.** Task 3 now gives both Masonry and Stack real Motion layout projection with the named Nightshift spring; packed x/y/width changes no longer fall through to Motion defaults.
- [x] **Prune `@fontsource`** down to Bricolage Grotesque + Work Sans now that `nightshift` won (souki asked for this explicitly; bundle size matters).
- [x] Keep the `/prototype/identity` lab as a reference on the dedicated `design/identity-lab` branch rather than shipping it in the production branch.

### Task 2 - Colour system (full-card tint)

Decisions: full-card tint; keep the nine persisted colour keys plus default and re-value them; `src/styles/globals.css` is the live token source; colour is decorative; colour-blind mode re-values the same selectors.

- [x] Define the nine-key palette plus default in `src/styles/globals.css`, with day pigment and night light values under the same `data-note-color` selector. Add colour-blind values for the same tokens.
  Day, night and the colour-blind variant are all defined and shipping.
  **The variant is a modifier, not a theme** (decided 2026-08-03): `.cvd` composes with `light`/`dark` on `<html>` rather than replacing them, because colour vision and a preference for a dark room are independent and a third theme would force a user to trade one for the other.
  `CONTEXT.md`'s "a user has exactly one active Theme at a time" is what is out of step here, not the implementation - the modifier re-values three primitives (`--note-tint`, `--note-edge`, `--note-neon`) and nothing else, so calling it a theme overstates its reach by an order of magnitude.
  **One mode, not one per condition.** Deuteranopia and protanopia are both red-green and differ marginally; three palettes would be 3x the hand-tuned values to verify for a distinction two of them barely make. The single palette is optimised against all three at once.
  The values are measured, not chosen: a search maximising the *closest colliding pair* under simulated deuteranopia, protanopia and tritanopia, constrained to sRGB, to hold each hue within 12° of its name, and to keep chroma even enough that the nine still read as one set. Worst dichromatic pair improves from dE 0.0022 → 0.0345 by day and 0.0032 → 0.0784 by night; greyscale from ~0 → 0.0110.
  Delivery path: `prefs.colorBlind` is now a boolean (`z.boolean().catch(false)` - the `.catch` is load-bearing, since a stored `'deuteranopia'` from the old enum failing a bare boolean would reject the whole blob and silently reset toolbar, density and reduced-motion), stamped onto `<html>` by `PaletteVariant`, and toggled from Settings → Appearance.
  **Known cost:** the default palette holds lightness nearly constant (a 1% window by day, flat 76% at night) so the nine read as one paper stock and one strip light. Dichromacy erases most of the hue axis, so the mode has to carry identity on lightness instead and the cards visibly stop matching. That trade *is* the mode.
  **sRGB gamut repair (2026-08-03), found while measuring the above.** Eleven `oklch()` literals in `globals.css` were outside sRGB, so the browser was gamut-mapping them and the authored value was not the rendered one - and rendered *differently* per display, since a P3 phone lands closer to the authored value than an sRGB monitor. That matters here because the product is mobile-first and most phones are P3, while the dev monitor is sRGB: the palette was being designed against the version most users never saw.
  The worst case was `--accent-tone` at 34% outside, which is the exact colour The Two-Constraint Rule was resolved against; its measured ratios survive only because they were taken in a browser and therefore on the mapped colour.
  Chrome colours (`--accent-tone` day and night, `--info`, `--destructive`, two night neons) were clamped to their reachable value - no visual change, all floors still pass.
  The nine day tints were re-cut instead of clamped: five of nine were outside sRGB, so yellow rendered at more than twice red's chroma from authored values 0.006 apart, and "one paper stock" was false on any sRGB display. They now share one lightness and one chroma (`91.5%` / `0.0427`), the strongest the whole set can reach in sRGB, with `91.5%` also being the floor that keeps `--ink-soft` above 4.5:1 (4.60:1). `gray` is left alone - it is the near-neutral, already in gamut, and its documented closeness to `default` is deliberate.
  Guarded by `src/styles/globals.test.ts`, which parses every literal and fails on any outside sRGB. **Follow-up:** `.impeccable/design.json` still has 63 out-of-gamut values, almost all in generated tonal ramps; it is a sidecar rather than a rendered source, so it was left for its own pass.
  Spreading day lightness also dragged the darkest tints under the muted-text floor (`--ink-soft` at 50% measures 3.83:1 on the new red, where the default palette clears 5.2:1), so the mode deepens muted ink to 43% and restores the worst case to 5.17:1.
- [x] `NoteCard` reads `Note.color` → full-card tint that resolves per active theme. Tag pills read `Tag.color` from the same tokens.
- [x] **Card attachment previews** (`CardMedia`).
  Attachments are *grouped* rather than listed in document order, per the lab decision: visuals (image, video, drawing) collapse into one hero or one capped 2x2 wall with a `+N` tile, voice notes into one player with a `+N`, files into one row with a `+N`.
  A single visual keeps its own aspect ratio clamped at 4:3 of the card, so a landscape photo shows uncropped while a portrait can never run away with a column.
  The Body stays the authority on which attachments exist, in what order and of what kind (`lib/note-attachments.ts`); the Dexie row supplies only bytes and metadata.
  Attachment nodes are stripped out of the text preview so nothing renders twice, and the old foot-rail video/file chips are gone because they duplicated the card's own click target.
- [x] **Night depth re-cut.** The shipped values contradicted DESIGN.md's own Elevation section: a 52% identity border over a glow whose negative spread ate its radius read as a hot ring with no visible glow. Resting edge now 34%, glow `0 0 30px -8px` at 70%, hover `0 0 46px -10px` at 82%, pinned `0 0 38px -8px` at 88% behind the full-identity edge. Recorded in DESIGN.md as *The Glow-Carries-Depth-Not-The-Edge Rule*.
- [x] **Label overflow.** Cards cap at three pills then one `+N` that differs by fill. Fixed a real overflow: a flex item's default `min-width: auto` blocked the pill's own `truncate`, so a long single-word label drew through the card's border.
- [ ] Colour **palette popover** (swatch grid) shared by: editor action bar, card hover row, card `⋮`, tag manager, tag popover.
  `NoteColorPicker` is the one shared grid and is mounted on the card foot rail and in the tag manager (`/settings/labels`). The card `⋮` deliberately does *not* repeat it - the rail already carries the swatch, and the menu keeps only what the rail does not.
  Remaining mounts: the editor action bar (which Task 4 has yet to build) and `TagPopover`, which today creates and assigns labels with no colour control at all.
  Every swatch now carries its colour's **name** as a tooltip alongside its existing `aria-label`, always on rather than gated on the colour-blind preference. This is the palette's non-colour redundancy: no palette makes nine hues reliably separable under dichromacy, so the name has to be reachable for all of them - and naming a colour you are about to choose helps everyone. The grid carries its own `TooltipProvider` so a swatch cannot lose its only label by being mounted somewhere that lacks one.
  Deliberately **not** on the card: the card was tuned in Task 4 and adding a text element to it to restate what the tint already says is a cost with no matching gain. Revisit only if a measured pass shows the nine still colliding.
- [ ] Tests: token resolves per theme; card tint + tag pill colour render; default = neutral surface.
  Card tint, the default identity and the stored-token round-trip are covered (`NoteCard.test.tsx`, `note-colors.test.ts`), and tag pills render from the same attrs. "Token resolves per theme" is **not** unit-testable under jsdom (no cascade, no `@theme`); it belongs in the measured `DESIGN.md` gate below rather than in Vitest. Reword or move it.

### Task 3 - Motion animations

Decisions: `motion` (not GSAP); `useReducedMotion` ← reduced-motion pref.

- [x] Add dep `motion`.
- [x] `AnimatePresence` for feed entry/exit on lifecycle and filter changes (pin/archive/trash, tag-filter toggles).
- [x] **Layout animations** for feed reflow/reorder: pinned float-to-top and feed reflow are wired; checklist checked-sink remains with Task 5, which owns the checklist.
- [x] **Two feed layouts, and an animated switch between them** (decided 2026-07-30): **Masonry** (default, JS-placed column packing) and **Stack** (every card full container width, one per row; also the no-JS fallback). Both resolve through one pure per-card `x`/`y`/`width` placement module and one DOM-ordered Motion feed. The legacy persisted `list` value migrates to `stack`.
- [ ] Speed-dial expansion and tag-filter pill toggles use the Nightshift motion contract. Dialog transition consolidation remains.
  Both the speed-dial (`QuickCaptureBar`) and the tag-filter pills (`TagFilterBar`) are on `motion/react` with the shared tokens from `lib/motion.ts`. **Dialog consolidation is the only remainder** - `NoteEditorDialog` and the confirm dialogs still animate through their vendored shadcn `data-state` CSS rather than the contract.
- [x] Gate Motion globally and feed presence/layout locally on `useReducedMotion()` wired to `prefs.reducedMotion`.
- [ ] Tests: reduced-motion disables animation; presence/layout wrappers don't break existing interactions.
  Reduced motion is asserted on the card surface, the speed-dial and the desktop capture bar. The gap is `NoteFeed` itself, which has **no test file at all** - neither the presence/layout wrappers nor the `supported: false` Stack fallback is covered, and it is the one component where a Motion wrapper could silently break selection or keyboard order.

### Task 4 - Note action surfacing (lifecycle controls)

Decisions (Q15): editor bottom action bar; card pin corner; desktop hover row / mobile `⋮`; fallback to `⋮`-everywhere if cluttered.
**Revised 2026-07-31: there is no `⋮` on a card at all.** Once the rail carried archive/restore directly, the menu held exactly one item, and a menu in front of one button is a click that buys nothing. Every rail control is now a direct icon.

- [ ] `NoteEditorDialog`: persistent **bottom action bar** - pin, colour swatch, ＋Label (Slice 1 popover), archive, trash.
  Checked 2026-07-31, and the state is the *inverse* of what it looks like: the only control below the body is `NoteTagsBar`, which **is** the ＋Label popover. Pin, colour swatch, archive and trash do not exist in the dialog at all, and `NoteEditorDialog.tsx:246` still carries the "where Slice 4's action bar will join them" comment.
  So this bullet is four-fifths outstanding, not one-fifth. The card already has all four moves in `CardActions` + `CardPin`; the bar should reuse those handlers rather than restate them.
- [x] `NoteCard`: **pin** as a top-right corner toggle (`CardPin`, also the pinned indicator) and a **foot rail** (`CardActions`) of direct icon buttons - the note's one move *out* of its current state, the move *down* to the trash where one exists, and the colour swatch.
  Per state: active = archive + trash + colour; archived = restore + trash + colour; trashed = restore + colour.
  **Permanent deletion is not a card action** (decided 2026-07-31). The trash is itself the confirmation, so a note only leaves for good by expiring or through "Empty trash" on `/trash`. Consequence to be aware of: there is currently **no way to purge one specific note** - it is all of the trash, or none of it. Add a per-note purge to the trash view if that turns out to matter.
  Labels are deliberately not on the rail either: the rail is triage (what happens to this note), labelling is editing, and `NoteTagsBar` in the editor stays the one place labels are assigned.
  The rail is *always visible on every input type* (revised 2026-07-31), which is *The Foot rail (A)* anatomy rather than the planned "mobile = `⋮` only" and rather than the hover-reveal it shipped with first.
  A hover-revealed row makes a card's own actions undiscoverable until the pointer is already on it, and the row is laid out at rest either way - so revealing bought nothing and cost discoverability. Dropping the reveal also removed the `has-[[data-state=open]]` latch and the reduced-motion fallback it needed, since there is no longer a hidden state to fall back from.
  The pin is shown only on an Active note - pinning is meaningless in the archive and the trash - and `⋮` keeps only what the rail does not already carry.
- [x] Tests: pin/unpin, archive and recolour fire the Slice 1 mutations from the card; the pin is asserted to mount outside the content layer; the rail is asserted to carry no hover-hidden classes, so a reveal cannot be reintroduced by accident.

### Task 5 - Data-driven customisable toolbar + checklist polish

Decisions (Q11): flat ordered list `prefs.toolbar: string[]`; toggle now, drag-reorder fast-follow (dnd-kit); alignment + quick-capture prefs. Checklist (Q5): larger tap targets, drag-reorder via TipTap drag-handle, optional checked-sink.

- [ ] Refactor the editor toolbar to render from `prefs.toolbar` (visibility = filter, order = list). Hardcoded `*Section`s become implicit groupings/separators. Build on Pattern A (extension-owned buttons + icon registry + `ExtensionButtonBar`).
- [ ] Settings → toolbar editor: **toggle switches** for each button (step 1).
- [ ] **Drag-reorder** editor (fast-follow, add `@dnd-kit/*`): reorder the button list (step 2).
- [ ] Prefs: note-create-button **alignment (L/R)**, **which quick-capture buttons appear**.
- [ ] **Checklist polish**: larger tap targets on the body TaskList; drag-reorder via TipTap's official drag-handle extension; optional "sink checked items to bottom of their list" on toggle.
- [ ] Tests: toolbar renders/filters/orders from prefs; alignment pref; checklist reorder + checked-sink.

### Task 6 - Settings surface complete

- [ ] Settings sections: appearance (theme, **colour-blind**, **density/font-size**, **reduced-motion**), **language switcher** (`country-flag-icons`, already a dep), toolbar customisation, note-create config, backup (Slice 1), replay tutorial (Slice 5), manage labels (Slice 1). Zed-style sectioned switches.
- [ ] Tests: each toggle persists via `PreferencesProvider` and takes effect.

## Deferred

- Drag-reorder is a fast-follow within the phase; toggle-only is the shippable milestone if time is tight.
- GSAP only if one choreographed showcase moment needs it (avoid two anim libs).

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual: prototype signed off before production CSS; cards lift on hover; colour tints correct in light/dark/colour-blind; pin float + reflow animate (and stop under reduced-motion); Masonry↔Stack switch animates rather than re-rendering; toolbar toggle + reorder persist; checklist reorder + checked-sink; every Settings switch persists and applies.
- Measured gates from `DESIGN.md` (numbers, not impressions): every accent clears 4.5:1 on its own text **and** 3:1 against its canvas, in both themes; no touch target under 44×44; pin legible over a dark video thumbnail and a white photo; pin reflow's first frame within ~16ms of the click with no frame exceeding the spring's own step.
