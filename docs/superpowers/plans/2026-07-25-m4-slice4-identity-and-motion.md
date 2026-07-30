# M4 Slice 4 - Identity & motion

**Status:** Task 1 complete; Task 1b foundation + card + chrome implementation in progress.

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
- [x] **FAB fill.** Production already uses the filled 56px primary Button; the implementation only replaces its generic elevation with the named token.
- [ ] **Pin in front.** Deferred to Task 4 because production does not have a card pin control yet. Per *The Pin-Is-Always-In-Front Rule* the new control must sit above every card layer with its own filled backing.
- [ ] **Reflow responsiveness.** Deferred to Task 3, which introduces the JS masonry hook that this measured lab defect refers to. Observe once, call the latest `measure` through a ref. Ship gate: first frame within ~16ms **and** no frame moving further than the spring's own step.
- [ ] **Wire the reflow transition.** Deferred to Task 3 because production currently uses CSS columns and has no x/y Motion placement path.
- [x] **Prune `@fontsource`** down to Bricolage Grotesque + Work Sans now that `nightshift` won (souki asked for this explicitly; bundle size matters).
- [ ] Decide whether the `/prototype/identity` lab stays in the repo as a reference or is removed once production CSS lands.

### Task 2 - Colour system (full-card tint)

Decisions: full-card tint; keep the nine persisted colour keys plus default and re-value them; `src/styles/globals.css` is the live token source; colour is decorative; colour-blind mode re-values the same selectors.

- [ ] Define the nine-key palette plus default in `src/styles/globals.css`, with day pigment and night light values under the same `data-note-color` selector. Add colour-blind values for the same tokens.
- [ ] `NoteCard` reads `Note.color` → full-card tint that resolves per active theme. Tag pills read `Tag.color` from the same tokens.
- [ ] Colour **palette popover** (swatch grid) shared by: editor action bar, card hover row, card `⋮`, tag manager, tag popover.
- [ ] Tests: token resolves per theme; card tint + tag pill colour render; default = neutral surface.

### Task 3 - Motion animations

Decisions: `motion` (not GSAP); `useReducedMotion` ← reduced-motion pref.

- [ ] Add dep `motion`.
- [ ] `AnimatePresence` for enter/exit on lifecycle + filter changes (pin/archive/trash, tag-filter toggles).
- [ ] **Layout animations** for feed reflow/reorder: pinned float-to-top, feed reflow, checklist checked-sink.
- [ ] **Two feed layouts, and an animated switch between them** (decided 2026-07-30): **Masonry** (default, JS-placed column packing) and **Stack** (every card full container width, one per row; also the no-JS fallback). Both must resolve to per-card `x`/`y`/`width` targets through the *same* placement path - a layout that renders through a different code path cannot animate into one that doesn't. Note this transition changes card **width**, which the pin reflow never does, so it is the more expensive of the two. See *The Two-Layouts Rule* and *The Layout-Switch Is Animated Rule* in `DESIGN.md`.
- [ ] Speed-dial expand/collapse (Slice 2 FAB), dialog transitions, tag-pill toggles.
- [ ] Gate all motion on `useReducedMotion()` wired to `prefs.reducedMotion`.
- [ ] Tests: reduced-motion disables animation; presence/layout wrappers don't break existing interactions.

### Task 4 - Note action surfacing (lifecycle controls)

Decisions (Q15): editor bottom action bar; card pin corner; desktop hover row / mobile `⋮`; fallback to `⋮`-everywhere if cluttered.

- [ ] `NoteEditorDialog`: persistent **bottom action bar** - pin, colour swatch, ＋Label (Slice 1 popover), archive, trash.
- [ ] `NoteCard`: **pin** as a corner toggle (top-left/right, whichever fits the redesign; also the pinned indicator). **Desktop** = hover-revealed bottom action row (colour, archive, trash, `⋮` more for tags/duplicate), placed to avoid the existing bottom-right media buttons. **Mobile** = always-visible `⋮` overflow menu (same actions).
- [ ] Tests: actions fire the Slice 1 mutations; hover row / `⋮` render per breakpoint.

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
