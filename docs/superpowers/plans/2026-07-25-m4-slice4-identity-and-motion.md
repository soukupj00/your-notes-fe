# M4 Slice 4 - Identity & motion

**Status:** not started.

**Goal:** Give the app a distinctive "tactile paper" identity, add purposeful Motion animation, ship the full-card colour system, and make the toolbar user-customisable - turning a competent app into one that feels intentional and personal.

**Depends on:** Slices 1-3 (a consistent, complete surface to redesign; preferences store for toolbar/colour-blind/density; Motion pairs with the reduced-motion pref).

**Cross-cutting rule:** new strings ship `en` + `cs`. Respect `prefers-reduced-motion` everywhere.

## Context

Item 14: components currently look "straight out of the box" (shadcn defaults). North star chosen in grilling: **"Tactile paper"** - notes as physical cards you can lift. Several earlier decisions were made to feed this: full-card colour tints (Q9), a physical pin (Q15), Motion spring physics (Q17). **Build a prototype before touching production CSS.**

## Tasks

### Task 1 - Redesign prototype (validate first)

- [ ] Build a small **Artifact** prototype: one note card + a short feed in the "tactile paper" direction (layered shadows, spring pop-forward on hover, whisper of paper grain, refined colour tints, pin/tape affordance, humanist display face for titles + clean body face). Get sign-off before committing production code. This can change - it's the north star, not a contract.

### Task 2 - Colour system (full-card tint)

Decisions: full-card tint; palette tokens as `{light, dark}` OKLCH pairs in `themes.ts`; colour is decorative; colour-blind theme re-values the same tokens.

- [ ] Define the palette in `src/themes.ts`: ~8-10 named tokens + default, each a `{ light, dark }` OKLCH pair (structure matches existing theme tokens). Add colour-blind-theme values for the same tokens.
- [ ] `NoteCard` reads `Note.color` → full-card tint that resolves per active theme. Tag pills read `Tag.color` from the same tokens.
- [ ] Colour **palette popover** (swatch grid) shared by: editor action bar, card hover row, card `⋮`, tag manager, tag popover.
- [ ] Tests: token resolves per theme; card tint + tag pill colour render; default = neutral surface.

### Task 3 - Motion animations

Decisions: `motion` (not GSAP); `useReducedMotion` ← reduced-motion pref.

- [ ] Add dep `motion`.
- [ ] `AnimatePresence` for enter/exit on lifecycle + filter changes (pin/archive/trash, tag-filter toggles).
- [ ] **Layout animations** for feed reflow/reorder: pinned float-to-top, masonry/list reflow, checklist checked-sink.
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
- Manual: prototype signed off before production CSS; cards lift on hover; colour tints correct in light/dark/colour-blind; pin float + reflow animate (and stop under reduced-motion); toolbar toggle + reorder persist; checklist reorder + checked-sink; every Settings switch persists and applies.
