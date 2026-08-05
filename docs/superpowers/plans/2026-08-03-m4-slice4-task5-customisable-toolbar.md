# M4 Slice 4 Task 5 - Customisable toolbar

**Status:** **complete** (2026-08-05). All seven steps plus 4b/4c/4d are done; the manual gates in *Verification* below are the only thing outstanding, and they need a real device rather than jsdom.

**Goal:** Make the editor toolbar the user's own.
Which controls exist, in what order, grouped or collapsed, separately for a phone and a desktop, plus the same treatment for the quick-capture actions.
This is the feature that turns a competent editor into *their* editor.

**Depends on:** Slice 1's `PreferencesProvider` (the persisted blob), ADR 0004 (Pattern A extension-owned buttons), Slice 4 Task 4 (the editor note bar this sits above).

**Supersedes:** Task 5 of [`2026-07-25-m4-slice4-identity-and-motion.md`](./2026-07-25-m4-slice4-identity-and-motion.md), whose toolbar half is replaced by this document.
Its checklist half is now Task 5b of that plan and is not covered here.

**Cross-cutting rule:** new strings ship `en` + `cs`.
Respect `prefers-reduced-motion`.
Land tests with each step.

## Context

The starting state, measured rather than assumed:

- The toolbar is five hardcoded `*Section` files listing TipTap extension names, rendered by `ExtensionButtonBar`.
- **Names are not buttons.** `heading` yields three buttons, `textAlign` three, `history` two. The real leaf count is 31, not the 25 names suggest.
- Ids are inconsistent (`Mathematics`, `backgroundColor`, `imageAttachment`) and were never designed to be a public id space.
- **`hideOnMobile` is already a second toolbar layout**, owned by developers. Twelve leaves carry it, so Blockquote, Math, Strike, Clear, all three Align and both Font controls are unreachable on a phone today.
- **Undo and redo are built but registered nowhere.** On a phone, with no `Ctrl+Z`, undo is currently unreachable at all.
- `prefs.toolbar: string[]` and `prefs.quickCaptureButtons: string[]` exist and have **never been written**. `quickCaptureButtons` defaults to `['note','checklist']` while the action keys are `text|checklist|audio|drawing|picture`, so `'note'` matches nothing. Both defaults are free to change.
- `SLASH_ITEMS` is a third parallel list of the same actions with its own keys, icons and labels. It documents that it should stay in step with the toolbar; it has drifted (Math is a toolbar button with no slash item).

## Decisions

Taken in the 2026-08-03 grilling session. Vocabulary is in [`CONTEXT.md`](../../../CONTEXT.md) under *Editing*: **Toolbar Family**, **Toolbar Item**, **Toolbar Layout**, **Width Class**.
The shape decision is [ADR 0011](../../adr/0011-toolbar-items-and-families.md).

1. **The unit is a Toolbar Item, not an extension name.** A registry maps a stable id to an icon, a label, a family, and the extension button view it renders. Behaviour stays with the extension (Pattern A holds).
2. **Two Layouts, one per Width Class.** Not one list with priority overflow. The settings editor has a Compact/Wide toggle at the top and edits one at a time.
3. **`hideOnMobile` is deleted.** Its information moves into the Compact preset. Nothing about which buttons a phone shows stays in extension code.
4. **The Compact bar is one row with horizontal scroll**, never wrapping. It is sticky above the keyboard; stealing vertical space from the note is the one thing it may not do. No measurement, no overflow popover.
5. **Families are the unit of the settings UI**, each expanded or collapsed. "A collapsed menu plus its own leaves on the same bar" is unrepresentable rather than merely invalid.
6. **A collapsed family reports its state.** The trigger's icon is the family's current state (`¶` / `H2`, the active list type, the current alignment); action-only families fall back to a static icon. Collapsing costs information, and this is what pays it back.
7. **The popover holds the real leaf buttons.** Same `ActionButton`s, same `isActive`, same tooltips. Per-leaf on/off still applies inside a collapsed family, and a family with every leaf off does not render.
8. **Absent means new, not hidden.** Reconciliation against the registry on read: registry ids missing from the blob are appended at their registry position with their default state, so a button shipped next release appears for existing users. Ids in the blob missing from the registry are kept in storage but not rendered, so a temporarily unregistered extension cannot erase an arrangement.
9. **Presets are a stamp, not a mode.** Minimal / Balanced / Everything write a full Layout into the current Width Class. There is no "am I still on a preset" state, and Reset is re-stamping Balanced.
10. **Two entry points, one component.** A `Settings` section and a sheet layered over the editor dialog, opened by a trailing `⚙` Item. The in-editor path **must not navigate**: the editor may hold an unsaved draft, and routing away would either destroy it or force the `ensureNoteId` race Task 4 refused for archive and trash. The sheet mount also gives live preview against the real note for free.
11. **The settings editor drills in.** Top screen is the eight or so family rows; tapping one pushes into a flat list of its buttons. Every list is single-level, so nested drag-and-drop never exists.
12. **Drag-reorder is core, not a fast-follow.** Order is half of what a Layout is. `@dnd-kit/sortable` with its keyboard sensor, drag handle as the only drag origin, no parallel up/down buttons.
13. **The registry owns the id and presentation of an editor action; behaviour stays per surface.** `SLASH_ITEMS` keeps its own `run` and `keywords` but keys them by registry id and drops its duplicate icon and label.
14. **Two customisable surfaces, deliberately not three.** The editor toolbar (full model) and quick capture (a plain ordered list, no families, no Width Classes). The card foot rail is **not** customisable: it is per-State, and letting a user remove Restore leaves a trashed note with no way back. The sidebar is a plausible later candidate and is out of scope.

## Data shape

`prefs.toolbar` changes type in place.
No `PREFERENCES_VERSION` bump: the field has never been written, so a field-level absorber is enough, following the `colorBlind` precedent from 2026-08-03 (a whole-blob rejection would take the user's density and reduced-motion down with it).

```ts
type ToolbarFamilyPref = {
  id: string;                              // array position = family order
  on: boolean;                             // whole family present
  collapsed: boolean;                      // one menu, or its leaves
  members: { id: string; on: boolean }[];  // leaf order + visibility
};

toolbar: { compact: ToolbarFamilyPref[]; wide: ToolbarFamilyPref[] };
quickCapture: { id: string; on: boolean }[];   // replaces quickCaptureButtons
noteButtonAlignment: 'left' | 'right';         // unchanged
```

Order and visibility travel in one array so there is no second list to keep in sync.
Desktop quick capture stays a **derivation** (`text` filtered out, because the "Take a note" bar is the text action), never a second stored list.

## Proposed registry

Ten families, 32 leaves. Ids are a fresh, clean space; this is the one free moment to fix them, because after this ships an id is persisted user data and a rename is a migration.

| Family | Leaves |
| --- | --- |
| `history` | `undo`, `redo` |
| `style` | `h1`, `h2`, `h3` (collapsed trigger reports `¶` outside a heading) |
| `format` | `bold`, `italic`, `underline`, `strike`, `code`, `link`, `clear` |
| `colour` | `text-color`, `highlight` |
| `list` | `bullet-list`, `ordered-list`, `task-list` |
| `block` | `blockquote`, `code-block`, `divider`, `math` |
| `align` | `align-left`, `align-center`, `align-right` |
| `media` | `image`, `audio`, `video`, `file`, `drawing` |
| `font` | `font-family`, `font-size` |
| `meta` | `customize` (the `⚙`, on by default, itself toggleable) |

Renames worth calling out: `Mathematics` → `math`, `backgroundColor` → `highlight`, `color` → `text-color`, `horizontalRule` → `divider`, `imageAttachment` → `image` (and the same for audio/video/file/drawing).

## Proposed presets

Tunable in step 5 against a real 360px device; the shapes below are the starting proposal, not a measured result.

**Compact / Balanced (the mobile default), 7 items** - tuned in Step 5 against the measured 360px capacity, superseding the 10-item proposal below it:
`history ▾`, `style ▾`, `format ▾`, `list ▾`, `colour ▾`, `media ▾`, `⚙`.
Compared with today's phone bar this **adds** undo and redo (there is no Ctrl+Z on a phone) and colour, and costs one tap for every move. `block`, `align` and `font` are off rather than collapsed - see Step 5 for why.

**Compact / Minimal, 5 items:** `style ▾`, `bold`, `list ▾`, `media ▾`, `⚙`.

**Wide / Balanced (the desktop default):** `history` expanded, `style` expanded, `format` expanded, `colour` expanded, `list` expanded, `block` expanded, `media` expanded, `align` collapsed, `font` collapsed, `⚙`.
Roughly today's bar plus undo/redo, with align and the two font selects folded into menus.

**Everything:** every family on and expanded, in registry order.
On Compact that is a 32-item horizontal scroll. It is allowed, and the fold marker is what tells the user.

**Known limitation of the family model, accepted:** because a family is expanded or collapsed as a whole, you cannot have `bold` loose on the bar *and* the rest of `format` behind a menu. The Compact Balanced preset resolves this by expanding `format` with only three leaves on; the other four stay reachable through the slash menu, keyboard shortcuts, or by the user turning them on. Surfaced here rather than discovered later.

## Tasks

Each step is green (tests, typecheck, lint) before the next begins.

### Step 1 - Registry and Family model - **done** (2026-08-04)

- [x] `src/components/editor/toolbar/registry.ts`: id, icon key, i18n label key, family, and how the id resolves to its extension's Pattern A button view. Pure data plus a resolver, no React. Types are in `toolbar/types.ts`, presets in `toolbar/presets.ts`.
- [x] Family definitions: id, label, collapsible or not, collapsed-trigger behaviour (`reportsState`, or the family's static `icon`).
- [x] Built-in preset definitions (Minimal / Balanced / Everything, per Width Class).
- [x] The id renames above.
      **Deviation:** the *extension* names stay upstream's (`Mathematics`, `backgroundColor`).
      Renaming a TipTap extension renames the mark and breaks every stored document that carries it; the registry's `extension` field is exactly the indirection that lets our id space be clean without touching theirs, which is what ADR 0011 is for.
- [x] Tests: every registry id resolves to a mounted extension with a `button`; every preset covers exactly the registry's families and leaves; every family has at least one leaf; ids are unique; every icon key and label key actually exists.

Also in this step, because the tests could not be honest without them:

- [x] `undoRedo` (the `history` extension) is **registered** in the editor for the first time, so `undo`/`redo` resolve at all.
- [x] `extensions/build.ts` - the editor's extension list moved out of `editor.tsx` into `buildEditorExtensions()`, so the registry test resolves against the *real* mounted set rather than a copy that can drift (this is the class of bug the missing `videoAttachment` was).

**Open, for Step 5's tuning pass:** the Compact/Balanced preset as built is 12 items, not the 10 listed above - it keeps `redo` and adds `align` collapsed, which is what the prose promise ("adds undo, redo, Blockquote, Math, the divider and every alignment") requires. Confirm against a real 360px device.
**Resolved in Step 5 (2026-08-05):** 12 was three-quarters again over the seven slots a 360px phone shows, so the default is now seven collapsed families' worth. The prose promise above is the thing that gave way; see Step 5.

### Step 2 - Toolbar renders from a resolved Layout - **done** (2026-08-04)

- [x] `resolveLayout.ts`: `reconcileLayout` is decision 8 (storage-shaped, keeps unknown ids, inserts new registry ids at their registry position with their default state) and `resolveLayout` turns the result into the render list.
- [x] The toolbar renders from that list (`toolbar/EditorToolbar.tsx`). The five `*Section` files and their separator markup are deleted; grouping is implicit in family order.
      **Deviation:** `ExtensionButtonBar` is deleted too, not just stripped of `hideOnMobile` - the sections were its only callers, and the registry's resolver replaces it. The whole `menus/` folder is gone.
- [x] **Deleted `hideOnMobile`** from `button-types.ts` and all twelve leaves that set it.
- [x] Width Class from `useWidthClass()` over the app's single `sm` hook (`useIsMobile`), so a resized desktop window switches Layout.
- [x] Both Layouts are still the built-in defaults (the prefs shape is Step 4). `EditorToolbar` takes an optional `layout` prop that Step 4 fills in.
- [x] Tests: 11 in `resolveLayout.test.ts`, 3 in `EditorToolbar.test.tsx`.

**Known intermediate state, closed by Step 3:** a `collapsed` family still draws its leaves inline, because `ToolbarFamilyMenu` does not exist yet.
So the Compact default currently shows every leaf of style/list/colour/block/align/media on one scrolling row instead of six triggers.

### Step 3 - Collapsed family control and the compact bar - **done** (2026-08-04)

- [x] `ToolbarFamilyMenu`: state-reporting trigger (`triggerIcon`) plus a popover containing the family's real leaf buttons. Active-state highlighting comes free from the leaves' own `isActive`. A chevron marks it as a menu rather than a button whose icon keeps changing under the user.
- [x] A family whose leaves are all off does not render (`resolveLayout`), **and** one whose leaves cannot resolve does not render either (`ToolbarFamilyMenu`) - an unmounted extension must not leave a trigger that opens an empty popover.
- [x] Compact bar is a single non-wrapping row with horizontal scroll and an edge fade. The fade is scroll-aware (`useEdgeFade`): it appears only on an end that is actually hiding something, so a bar that fits is not dimmed into implying more.
- [x] `ToolbarLeaf` extracted so the bar and the popover render a leaf identically.
- [x] Tests: 6 in `ToolbarFamilyMenu.test.tsx`, plus the collapsed-family case in `EditorToolbar.test.tsx`.

Two test-suite changes this forced, both of them the behaviour change showing up where it should:

- `src/test/setup.ts` now stubs `ResizeObserver`, which jsdom does not ship.
- `editor.test.tsx` no longer expects the three alignment buttons on the bar - the Wide default collapses `align`, so it asserts the trigger and their *absence* from the bar instead.

**Still to verify manually** (needs a real device, not jsdom): that the scrolling row does not fight the sticky-above-keyboard positioning.

### Step 4 - Prefs shape - **done** (2026-08-04)

- [x] `preferencesSchema`: `toolbar` is `{ compact, wide }` with a `.catch` on the object **and** on each Width Class, so one corrupt Layout does not cost the other; `quickCaptureButtons` becomes `quickCapture` (`{ id, on }[]`). No version bump. Ids stay `z.string()`, not the registry unions, so a blob from a later release round-trips instead of being validated away.
- [x] `setPreference` writes a whole Layout; the existing read-modify-write transaction already covers concurrent writes.
- [x] `EditorToolbar` takes `layouts` (both Width Classes) and `editor.tsx` feeds it `preferences.toolbar`, so the bar is live against the store.
- [x] `resolveLayout` treats an **empty** array the same as an absent one - the schema's default is `[]`, and reconciling that entry by entry would rebuild the bar in registry order rather than the default preset's.
- [x] Tests: the two legacy shapes absorbed without resetting their neighbours, one broken Width Class not costing the other, an unknown-id Layout round-tripping, a whole Layout written and read back.

Two test files now wrap in `PreferencesProvider` (`editor.test.tsx`, `NoteEditorDialog.realEditor.test.tsx`) because the toolbar reads the store.

### Step 4b - Three findings from using it - **done** (2026-08-04)

Raised after Step 4, from actually driving the bar rather than reading it.

- [x] **Undo must not be able to scroll away.** On the compact bar the **first family is pinned** (`position: sticky; left: 0`) while the rest scrolls under it, and the left edge-fade is suppressed so the pinned control stays legible.
      A second always-visible row was considered and rejected: on mobile it breaks this bar's one hard rule (it sits above the keyboard, so it may not take vertical space from the note), and on desktop it spends a row on two buttons that never leave the screen anyway.
      Pinning needs no setting and no new vocabulary, because *which* family is pinned is already the user's choice - it is whatever they put first. `history` is first in both defaults.
- [x] **A tooltip floating over a popover was both redundant and mispositioned.** A collapsed family's popover is now a proper menu: each row is the same button, with the same `isActive` and action, plus its **name and keyboard shortcut** rendered inline (`ActionButton` gained `showTooltip`).
      This is still decision 7 - the popover holds the real leaf buttons - it just stops asking a floating tooltip to label a control inside another floating layer. It also labels the menu on **touch**, where a tooltip never appears at all.
      Custom-component leaves (the colour pickers, the font selects) render as-is: they bring their own trigger and are self-describing.
- [x] **A family the editor cannot draw is dropped before it can be positioned.** `resolveLayout` is pure and knows nothing about which extensions are mounted, so an unmountable family used to render as an empty box - and could be the one that got pinned.
- [ ] **Keyboard shortcuts for the actions that have none.** Split out below as Step 4c; it needs sign-off on the bindings, not just code.

### Step 4c - Keyboard shortcut audit - **done** (2026-08-04)

Confirmed first, then fixed. `Clear` did indeed advertise `Mod+\\` and bind nothing - it is our own `Extension.create` and TipTap has no default for clearing formatting. `textAlign` did indeed already bind `Mod-Shift-l/e/r/j` upstream.

| Action | Binding | What changed |
| --- | --- | --- |
| `clear` | `Mod+\\` | **Bound.** It was advertised from the start and did nothing. |
| `link` | `Mod+K` | New. Opens the URL popover when its button is mounted, and falls back to a prompt when it is not - the whole `format` family can be collapsed, and a shortcut that silently does nothing is worse than an ugly prompt. |
| `highlight` | `Mod+Shift+H` | New, and it **toggles the default yellow** rather than opening the picker: a popover cannot be opened from a key when its button lives inside a closed menu, and "highlight this" is what the key is reached for. |
| `math` | `Mod+Shift+M` | New. Same prompt the button uses. |
| `align-left/center/right` | `Mod+Shift+L/E/R` | **Display only** - already bound upstream, just never shown. Three working shortcuts were invisible. |

**Not bound, deliberately:** the five media inserts. They open a file picker, which browsers gate on a live user activation, and the memorable candidates (`Mod+Shift+I`, `Mod+Shift+P`) are devtools and print.

Also: `Link` became `createLink(t)` (the `createMathematics` shape), because the fallback prompt needs a translated label and an extension is built once, outside React. `EditorColorPickerButton` gained a shortcut line so a custom-component button describes itself the same way a plain one does.

The guard against a repeat is `toolbar/shortcuts.test.ts`: it walks every registry Item, reads what its button advertises, and fails if the extension manager has no handler for it. **A shortcut shown and not bound cannot ship again.**

### Step 4d - Editor chrome fixes - **done** (2026-08-04)

Three defects found by using the editor, none of them strictly toolbar work, all of them in its immediate frame.

- [x] **The autosave check/spinner sat 8px above the close button's centre line.** It was a bare 16px icon at `top-4` next to a 32px button at `top-4`. It is now a matching 32px box, with a gap between the two rather than none.
- [x] **The dialog close button was a 32px touch target.** The disc stays 32px; the *hit box* is now 44px, grown with an invisible inset overlay rather than a bigger disc - the same treatment as the card foot rail's pin.
- [x] **The font family and font size selects both read "Default".** Nothing on either closed trigger said which control it was, and the tooltip that disambiguated them does not exist on a touch screen. Each trigger now carries its own icon and a short value (`Aa` / `Auto`, `Serif` / `24`), and the open menu previews what each row does - a family in its own face, a size at its own size. The full names are localised (`en` + `cs`); they were hardcoded English before.

### Step 5 - Settings editor - **done** (2026-08-05)

- [x] Shared `ToolbarLayoutEditor`: Compact/Wide segmented toggle defaulting to the current Width Class and labelled by window width rather than by device; family rows with drag handle, name, on/off switch, expanded/collapsed control; drill-in to a flat leaf list that keeps and displays the Width Class in its header.
      Every change writes straight through - the bar (or the preview strip) is the feedback, so there is no draft state and no Save to abandon halfway.
- [x] `@dnd-kit/core` + `@dnd-kit/sortable`, wrapped once as `ui/SortableList.tsx` so the toolbar and quick capture reorder identically. Drag handle is the only drag origin (these rows carry switches and a drill-in target, and a row that dragged from anywhere would swallow the first pixels of each). Keyboard sensor on, with translated announcements. No parallel up/down buttons.
- [x] Preset buttons (stamp, not mode). **No separate Reset:** decision 9 defines Reset as re-stamping Balanced, so it *is* that button, marked as the default - one control per outcome rather than two that produce byte-identical results.
- [x] **Fold marker** (`foldMarker.ts`), in the Compact tab and drawn again inside the preview strip so the count and the shape agree. `COMPACT_FOLD_SLOTS = 7` is arithmetic, not a guess: the dialog is full-bleed on a phone with `p-6`, leaving 312px, and `n` buttons at `min-w-9` with `gap-1` need `40n - 4`.
      **Corrected in Step 8:** the arithmetic used the button's *mouse* width. The 44px Touch Rule raises it under `pointer: coarse`, which is the only pointer a 360px phone has, so the real number is 6 and this shipped a marker that disagreed with the device it named.
- [x] Quick-capture section: the same row component over the plain ordered list, plus the note-create alignment (L/R) control.
      Both preferences had **never been read by anything** - the dial and the desktop row rendered the shipped constant, and the FAB sat centred - so this step also wired the consumers. Desktop stays a derivation (`text` filtered out), never a second stored list.
      The last start on the dial cannot be switched off: on a phone it is the only way to make a note at all.
- [x] Mount both in `Settings`, with a static preview strip for the toolbar - drawn from the registry rather than from a live editor, because mounting TipTap to show eight icons would pull the whole editor into the settings route's bundle.
- [x] Tests: 17 in `ToolbarLayoutEditor.test.tsx`, 16 in `layoutEdits.test.ts`, 5 in `ToolbarPreviewStrip.test.tsx`, 4 in `QuickCaptureSection.test.tsx`, 7 in `quickCaptureLayout.test.ts`, plus the two Settings mounts.
      The keyboard drag is really driven (Space / Arrow / Space) rather than waved at: jsdom reports every rect as 0x0, so the suite stacks the rows' geometry first. The 44px floor is asserted as the classes that produce it - jsdom has no layout, so the measured gate stays manual.

**The tuning pass Step 1 left open is resolved, and it changed the phone default.** Compact/Balanced as built was 12 slots where 7 fit, so a fresh install scrolled to reach its own toolbar. It is now `history▾ style▾ format▾ list▾ colour▾ media▾ ⚙` - six collapsed families plus the gear, exactly seven slots.
The cost, stated plainly because it walks back a promise in this document's own prose: `block`, `align` and `font` are **off** by default on a phone rather than collapsed, so Blockquote, Math, the divider and alignment are no longer on the default phone bar. At one slot each they would have put it three past the fold on day one. They stay reachable through the slash menu, a keyboard shortcut, or by being switched on - which is now a thing a user can do.
Undo also costs one tap on the default phone bar, since `history` is collapsed. It is still pinned (Step 4b), so it cannot scroll away.

Deviations worth recording:

- `reconcileList` moved out of `resolveLayout.ts` into `lib/reconcile-order.ts` and is now shared with quick capture. Both surfaces are "a list the user arranged, against a list the app ships", and decision 8 subtly diverging in two places is how one feature grows two behaviours.
- `DESKTOP_QUICK_CAPTURE_ACTIONS` is deleted; the derivation lives in `quickCaptureLayout.ts` where the stored order is applied.
- The colour-blind switch was missing the coarse-pointer 44px floor and now carries `.touch-target`.

### Step 6 - In-editor entry - **done** (2026-08-05)

- [x] `customize` Item renders the `⚙` at the end of the bar and opens `ToolbarLayoutEditor` in a **sheet over the editor dialog**. No navigation, no route change, no save.
      It is the one Item with no extension behind it, so `canRenderItem` is what keeps the bar's "drop what this editor cannot draw" filter from dropping the only way into the sheet.
- [x] The sheet edits the Width Class currently in effect, and the bar behind it updates live (the store is the single source; there is no draft to apply).
      The preview strip is shown **only on compact**, where the bottom sheet covers the bar it is editing; on a wide window the sheet takes the side and the real bar stays visible, which is a better preview than a picture of one.
- [x] Tests: 3 in `EditorToolbar.test.tsx` (the gear renders without an extension, opens the sheet without unmounting the bar, and disappears when switched off) and 2 in `NoteEditorDialog.realEditor.test.tsx` (an unsaved draft survives open-edit-close with nothing written to `notes`; a family switched off in the sheet leaves the bar behind it while it is still open).

**Fallout worth knowing:** two existing `EditorToolbar` expectations grew a `⚙`. Their stored Layouts predate `meta`, and reconciliation adds it *on* - which is decision 8 working, since until now the gear was silently dropped for having no extension.

### Step 7 - Slash menu onto the registry - **done** (2026-08-05)

- [x] `SLASH_ITEMS` keys are registry ids; the per-item `icon` and `labelKey` are gone, and `SlashMenuList` resolves both through `getToolbarItem`.
- [x] `run` and `keywords` stay in `slashItems.ts` (a slash run must consume the typed `/query` range; a toolbar action must not). `run` gained `t`, for the one item that has to ask the user something before it can act.
- [x] Added the missing `math` slash item, which is the drift this uncovers. It prompts with the same translated string the toolbar button uses, rather than a second prompt of its own.
- [x] Test: `names only actions the registry knows` walks every slash key through the registry, so the two surfaces can never show a different icon or label for the same action.

### Step 8 - The phone bar and the FAB, measured on a device - **done** (2026-08-05)

Step 5 tuned the phone default against arithmetic that was never checked in a browser.
Driving a real 360px viewport is what found the gap, and it moved three things.

- [x] **`COMPACT_FOLD_SLOTS` is 6, not 7.** The Step 5 arithmetic used `min-w-9` (36px), which is the button's width with a *mouse*. DESIGN.md's 44px Touch Rule raises every `[data-slot="button"]` to 44px under `@media (pointer: coarse)`, and a phone has no other pointer - so buttons need `48n - 4` px, and a collapsed family's trigger is 46px wider still because it carries a chevron. Six fit in 312px; seven need 332px.
      The measured consequence: the shipped default overflowed its own bar by 24px (312px of space, 336px of buttons) while the settings screen reported it as fitting. The marker was not conservative, it was wrong.
- [x] **The phone default is `↶ ↷ ¶▾ T▾ ≔▾ 📎▾`** - undo and redo as two real buttons, then four collapsed families, measured at exactly 312px in 312px.
      `history` is expanded because a phone has no Ctrl+Z: undo is the one control that may not cost a tap to *reach* before it costs a tap to use. This walks back the Step 5 note that accepted a collapsed `history`. Being first it is still the pinned family, so it cannot scroll away.
      `colour` is the slot that paid for it, and is now off rather than collapsed - text colour and highlight are the most decorative of the set, and the note's own colour is on the dialog's foot rail regardless.
      `meta` (the `⚙`) is off here too: it is a door to a settings screen rather than an editing control, and `/settings` mounts the same editor. It stays on in every other preset and Width Class, which is what `registry.test.ts` now asserts instead of "every preset".
- [x] **The FAB sits 24px above the safe-area inset and 16px in from the side**, up from 12px and 12px, via a shared `notes/floatingBottomBar.ts`.
      `env(safe-area-inset-bottom)` is 0 in an ordinary browser tab, so it does nothing about the strip the phone itself owns - Android's gesture handle, iOS Safari's toolbar, the swipe-up area both reserve. A primary control 12px off the edge is inside that strip.
      The constant is shared because a view's own action pill (Empty trash) lands in the same corner with the same geometry, and the two are never allowed to drift apart even though no route currently shows both.
- [x] Tests: 3 in `QuickCaptureBar.test.tsx` (the shared geometry is applied, the default side is the right thumb, and a left-handed layout mirrors the popover and its label alignment as well as the button), 1 in `resolveLayout.test.ts` (the phone bar opens with undo and redo as real buttons), and 1 in `registry.test.ts` (the phone default stays inside `COMPACT_FOLD_SLOTS`).

### Step 8b - Even spacing, and the dial unrolls from the `＋`

- [x] **The compact bar is `justify-between`.** A bar that fits now spreads across the width it has instead of bunching at the left with dead space beside it. It needs no "does it fit?" test because it *is* one: distributing free space is a no-op when there is none, so the Everything Layout packs and scrolls exactly as before (measured: 32 slots, 1033px in 330px, gaps stay at the base 4px). The preview strip in Settings takes the same class, or the picture would stop matching the bar.
- [x] **The pin is conditional on the row actually scrolling.** Pinning costs a wrapper, and a sticky family is *one* flex item instead of several - `justify-between` spreads around it rather than within it, so undo and redo hugged at 4px while everything else fanned out to 15.5px. A bar that fits has nothing to scroll under a pin anyway.
- [x] **`pr-1` came off the pinned wrapper**, which is what makes the above safe. With it, pinning cost 4px, so a bar that fit unpinned could overflow *because* it pinned and would then never unpin - a real latch, measured at 341px where 292px of buttons fit in 293px until the padding pushed them to 296px. With the wrapper costing exactly zero width, `scrolls` is a pure question about the buttons and cannot feed back into itself.
      Measured after: 300px pins and scrolls with the pin holding the left edge; 341px sits flat at 4.2px; 390px flat at 14px; 430px flat at 22px, flush to both edges.
- [x] **The speed dial unrolls upward from the `＋`**, first start nearest the thumb. `flex-col-reverse`, not a reversed array: the order the user arranged in settings is a priority, and reversing the array would put the primary start last in the DOM - last in the tab order and last to a screen reader. The stagger then falls out for free, since index 0 is the button beside the `＋`.
- [x] Tests: 3 in `EditorToolbar.test.tsx` (a scrolling bar pins its first family, a fitting bar pins nothing, and the wrapper carries no padding) and 1 in `QuickCaptureBar.test.tsx` (the list is `flex-col-reverse` and the DOM order is still the configured one).
      `stubOverflow` is new and needed: jsdom lays nothing out, so every element measures 0 and the bar can never discover an overflow. It stubs `scrollWidth`/`clientWidth` on `HTMLElement.prototype` and **must** be restored by hand, as this repo does not set `restoreMocks`.

### Step 8c - Every menu row has a name, and shortcuts are desktop-only

- [x] **A menu row's name comes from `MenuRowLabelProvider`.** Half the leaves are custom components that *wrap* an `ActionButton` rather than being one - `link`, the five attachment pickers, the two colour triggers - so `ToolbarLeaf`'s `Component !== ActionButton` branch rendered them as bare, nameless icons inside a popover sized for labelled rows. A prop could not reach the button through the wrapper, and would have to be threaded through every component added later; context is stated once by the menu and read by whichever `ActionButton` ends up being the row.
      The one hazard, recorded in the code: a portal keeps its place in the React tree, so an `ActionButton` rendered inside a leaf's own popover would also draw as a row. None do - those popovers hold inputs, swatches and plain `Button`s.
- [x] **The keyboard shortcut is desktop-only and tooltip-only.** New `useFinePointer` (`(pointer: fine)`) is the inverse of the signal behind the 44px Touch Rule, and deliberately the same one: a phone and a tablet both report coarse, and only a machine with a pointing device has the modifier keys a shortcut names. It is not a viewport width - a desktop window dragged narrow still has a keyboard. It defaults to `false` where it cannot be measured, suppressing the hint rather than showing an unusable one.
      The shortcut is off the menu row entirely: a collapsed family is overwhelmingly a phone, and the row is drawn the same on both.
- [x] **`EditorColorPickerButton` now uses `ActionButton` for its trigger.** It hand-rolled a trigger and a *copy* of the tooltip, under a comment promising the copy matched - the sort of promise that holds until one of the two changes. It had no way to draw itself as a menu row and no way to gate its own shortcut. Routing it through `ActionButton` fixes both and deletes the duplicate; `icon` becomes a registry key rather than an imported Lucide component, per the icon convention.
- [x] **Active styling is carried as a class, not only `data-[state=on]`.** A `PopoverTrigger asChild` writes its own `open`/`closed` over `data-state`, so every button that opens a popover - link, the colour triggers, each collapsed family trigger - had silently lost its active highlight. Pre-existing, found while moving the colour trigger onto `ActionButton`.
- [x] Tests: 6 in `ActionButton.test.tsx` (shortcut shown to a fine pointer and hidden otherwise, the menu row takes its name from context and drops its tooltip, active styling survives as a class) and 2 in `ToolbarFamilyMenu.test.tsx` (a custom-component leaf is named; no row carries a modifier symbol).
      One existing assertion was passing by accident: `expect(row.textContent).toMatch(/1$/)` was meant to prove `h1` drew `Mod+Alt+1`, but the label `editor.heading.h1` also ends in `1`, so it survived the shortcut's removal unchanged.

**Still unlabelled, and deliberately left:** `font-family` and `font-size` are shadcn `Select`s, not `ActionButton`s, so a collapsed `font` menu shows two rows reading "Aa" and "Auto" - their current values, which is text but not a name. They are self-describing on desktop through the tooltip. Naming them means giving `EditorTextStyleSelect` its own row treatment, which is a different shape from a button and worth deciding on its own.

**One rename this forced, worth recording.** The registry's `labelKey` is a *name*, and five of them pointed at tooltips: "Insert image" is what a button promises, but a list of things you can insert or switch on calls it "Image". So `editor.{image,audio,video,file,excalidraw}.label` now sit beside the existing `.tooltip`, `editor.slash.{heading1,2,3}` became `editor.heading.{h1,h2,h3}`, and the rest of the `editor.slash.*` block is deleted - the menu takes its names from the registry, so those keys had no second reader. `editor.slash.noResults` stays, being the menu's own chrome.

### Step 8d - The shortcuts get their own list, below the Layout editor

The shortcut had one home (a desktop tooltip) and no index: to learn `Mod+Shift+M` you had to already be hovering the Math button, which you can only do if Math is on your bar.
Step 4c bound them; nothing listed them.

- [x] **A read-only `ShortcutsSection` in `/settings`, directly under the toolbar section.** Not a column in the Layout editor, which was the first idea and the wrong one: that editor answers "what is on my bar, and in what order", and a shortcut answers "how do I do this *without* the bar" - the opposite question, and the one piece of text in those rows that would not be about the row's own state. It would also land on the surface most read on a phone, where the answer is always "you can't".
- [x] **Hidden entirely on a coarse pointer**, on `useFinePointer` - the same signal that drops the hint from a tooltip (Step 8c). Every row would otherwise be a promise a phone cannot keep.
- [x] **The registry gained `shortcut`**, and the list reads from there rather than from live button views. Settings has no editor to resolve against, for the same reason `ToolbarPreviewStrip` draws a picture instead of mounting TipTap - and mounting one to read twenty strings would pull the whole editor into the settings route's bundle. Registry order is family order, so the list reads in the same order as the bar.
- [x] **The copy is pinned in both directions.** `shortcuts.test.ts` gained a test comparing each Item's `shortcut` to what its button actually advertises: a stale entry teaches a key that does nothing, and a missing one hides a key that works. Together with the existing "advertised implies bound" test, a shortcut now has to agree with itself in three places or the suite fails.
- [x] **`link` was the one Item whose button hid its shortcut from the view.** `LinkButton` wrote `shortcutKeys={['Mod','K']}` in its own JSX, so `resolveItemButton('link').componentProps` reported none - meaning the Step 4c test never checked it either, and it was the single mismatch the new test caught. It now travels through `componentProps` like every other Pattern A button.
- [x] **Key caps show glyphs, the accessible copy shows words.** `⌘` and `⇧` are what is printed on the keyboard, and what a screen reader reads as punctuation or skips; `getShortcutKeys` already carries both spellings, so the row renders the symbols `aria-hidden` beside an `sr-only` "Control + Shift + S".
- [x] Tests: 4 in `ShortcutsSection.test.tsx` (a row carries its combination in readable words, the modifier is a glyph visually and a word to AT, nothing renders on a coarse pointer, and an Item without a shortcut takes no row) and 1 in `shortcuts.test.ts` (the registry mirror).

**Left out, with the reason.** A `?` hotkey opening the same list, which is the conventional second entry point: it needs a global key handler that has to stay out of the editor's own typing, and that is a decision about app-wide shortcuts rather than about this list.
The slash menu's `/` is also absent - it belongs on a list of ways in, but its trigger character lives in `SlashMenu.ts`, and importing that into Settings would drag `@tiptap/suggestion` and floating-ui into the route to print one character.

## Deferred / explicitly out of scope

- **Long-press on a toolbar button to customise.** Undiscoverable, and on mobile it collides with the OS text-selection menu right where the sticky bar sits. The `⚙` is the only in-editor entry.
- **Inline drag in the live toolbar.** Every drag would risk ProseMirror's selection and focus on an autosaving surface, for a gesture that is one tap away in the sheet.
- **Slash-menu filtering by Layout.** Step 7 leaves the door open (one id space); building it is a separate decision.
- **Sidebar destination customisation.** Plausible, but navigation is a different kind of decision from tools, and folding it in triples the settings surface.
- **Card foot rail customisation.** Refused, see decision 14.
- **Per-note or per-context toolbars.** Not asked for.

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual, both themes, phone and desktop widths:
  - Wide default matches the current bar plus undo/redo; Compact default is the new collapsed set.
  - The compact bar is one row that scrolls, never two rows, including with the on-screen keyboard open.
  - A collapsed family's trigger changes with the caret's context.
  - Reorder and toggle survive a reload, and a preset stamp is immediately visible.
  - Opening the `⚙` sheet from an unsaved draft, changing the Layout and closing it leaves the draft intact.
  - Resizing a desktop window across `sm` switches Layout without losing editor state.
- Measured gates:
  - Every settings row and drag handle is at least 44x44.
  - ~~The fold marker's count matches what actually fits at 360px.~~ **Done in Step 8** - it did not, and now does: 6 slots, and the default measures 312px in 312px at a 360px viewport.
  - No new layout shift in the editor dialog when the toolbar re-resolves.
- Still outstanding, because they need a real device rather than an emulated viewport:
  - The compact bar stays one row with the on-screen keyboard open.
  - The `⚙` sheet over the editor dialog behaves on a real phone.
  - The FAB's 24px lift clears the browser's own bottom chrome on iOS Safari and Android Chrome.
