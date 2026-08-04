# M4 Slice 4 Task 5 - Customisable toolbar

**Status:** in progress. Steps 1-4, 4b, 4c and 4d done (2026-08-04); Steps 5-7 open.

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

**Compact / Balanced (the new mobile default), 10 items:**
`undo`, `style ▾`, `bold`, `italic`, `underline`, `list ▾`, `colour ▾`, `block ▾`, `media ▾`, `⚙`.
Compared with today's phone bar this **adds** undo, redo, Blockquote, Math, the divider and every alignment (inside menus), and costs one tap for headings and lists.

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

### Step 5 - Settings editor

- [ ] Shared `ToolbarLayoutEditor`: Compact/Wide segmented toggle defaulting to the current Width Class and labelled by window width rather than by device; family rows with drag handle, name, on/off switch, expanded/collapsed control; drill-in to a flat leaf list that keeps and displays the Width Class in its header.
- [ ] `@dnd-kit/core` + `@dnd-kit/sortable`. Drag handle is the only drag origin. Keyboard sensor on, with live-region announcements. No parallel up/down buttons.
- [ ] Preset buttons (stamp, not mode) and Reset (re-stamp Balanced).
- [ ] **Fold marker** in the Compact tab: a labelled line after the number of Items that fit a typical phone width, so the user configures against the real constraint.
- [ ] Quick-capture section: the same row component over the plain ordered list, plus the note-create alignment (L/R) control.
- [ ] Mount both in `Settings`, with a static preview strip for the toolbar (the settings page has no live editor to preview against).
- [ ] Tests: reorder persists; toggle persists; drill-in preserves Width Class; a preset stamps a full Layout; Reset restores Balanced; the keyboard sensor moves a row; every row is at least 44px.

### Step 6 - In-editor entry

- [ ] `customize` Item renders the `⚙` at the end of the bar and opens `ToolbarLayoutEditor` in a **sheet over the editor dialog**. No navigation, no route change, no save.
- [ ] The sheet edits the Width Class currently in effect, and the bar behind it updates live.
- [ ] Tests: opening and closing the sheet leaves an unsaved draft unsaved and undestroyed; a change made in the sheet is visible in the bar behind it; turning `customize` off removes the `⚙` and leaves Settings as the only route in.

### Step 7 - Slash menu onto the registry

- [ ] `SLASH_ITEMS` keys become registry ids; its per-item `icon` and `labelKey` are dropped in favour of the registry's.
- [ ] `run` and `keywords` stay in `slashItems.ts` (a slash run must consume the typed `/query` range; a toolbar action must not).
- [ ] Add the missing `math` slash item, which is the drift this uncovers.
- [ ] Test: every slash key resolves in the registry, so the two surfaces can never show a different icon or label for the same action.

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
  - The fold marker's count matches what actually fits at 360px.
  - No new layout shift in the editor dialog when the toolbar re-resolves.
