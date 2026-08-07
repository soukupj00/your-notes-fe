# M4 Slice 4 Task 7 - Mobile topbar, in-app back, and the note URL

**Status:** **in progress** (2026-08-08).
Designed in a grilling session. Step 1 is done and verified in a browser; Steps 2-4 are not started.

**Goal:** Give the mobile topbar a job.
Today it is a hamburger and a gear with dead space between them, it never says where you are, and the app has no back affordance at all - which on an installed iOS PWA means no back affordance *whatsoever*.
Fix that with one rule, and while there, fix the reason the system back button is currently wrong on the app's busiest screen.

**Depends on:** [Slice 2.5](./2026-07-29-m4-slice2.5-sidebar-nav-shell.md) (the sidebar shell and the drawer this reasons about), [Slice 2](./2026-07-25-m4-slice2-search-and-capture.md) (URL-owned search state, whose principle Step 2 extends), [Task 5](./2026-08-03-m4-slice4-task5-customisable-toolbar.md) (the editor chrome Step 1 touches).

**Decisions:** [ADR 0010](../../adr/0010-shadcn-sidebar-as-nav-shell.md) is the shell this sits on.
Step 2 needs a new ADR - *the open note lives in the URL* - because it changes what a shareable link means and is the kind of thing a future reader will otherwise assume was accidental.

**Cross-cutting rules:** new strings ship `en` **and** `cs` (`translations.test.ts` gates it).
Every new control is 44x44 on a coarse pointer, through `.touch-target` or `.touch-reach` as the control's shape dictates.
Land tests with each step.

## Context

The starting state, read from the code rather than assumed.

- **The mobile topbar has a layout bug, not just an emptiness problem.**
  `navbar.tsx:102` is `flex items-center gap-4` with no `justify-between` and no spacer.
  On a feed, `SearchInput`'s root is `w-full` so it flexes and pushes the gear right.
  On `/settings` and `/settings/labels`, `searchable` is false, so the row collapses to `[hamburger] gap-4 [gear]` **both jammed against the left edge** with the rest of the bar dead.
- **The topbar never says where you are.**
  Feed `<h1>`s are `sr-only` (`NotesView.tsx:59`) and the settings pages render their `<h1>` in the content body.
  So on a phone, `/archive` is visually indistinguishable from `/` - same cards, same bar.
  `/trash` differs only because it floats an "Empty trash" pill.
  `/tag/$id` shows the tag's name nowhere on screen once the drawer closes.
- **The editor is not in the URL.**
  `NotesView.tsx:51` holds the open note in `useState`, and Radix `Dialog` does not touch history.
  So on Android, system back with the editor open runs the router back instead of closing the editor.
  This is the app's most-used surface and the one place the platform back button is actively wrong.
- **The editor already covers the topbar on mobile.**
  `NoteEditorDialog.tsx:234` is `top-0 left-0 h-[100dvh] w-full max-w-full rounded-none` below `sm:`.
  It is a full-screen sheet wearing a dialog's clothes, so there is no "topbar while editing" state to design.
  Its only close affordance there is the vendored Radix `X` at **top-right**, with the save-status spinner crammed beside it at `right-14`.
  Top-right is the least reachable point for a right thumb and reads as dismiss-and-discard rather than done.
- **The app is `display: 'standalone'`** (`vite.config.ts:31`).
  Installed on iOS there is no browser chrome and therefore no system back button at all.
  Android keeps gesture back in standalone; iOS does not.
  The in-app back is not a courtesy duplicate - for installed iOS users it is the only way up.
- **`index.html:8` has no `viewport-fit=cover`.**
  Without it the page lays out inside the safe area and every `env(safe-area-inset-*)` resolves to **0**, in the installed PWA as well as in a tab.
  So `floatingBottomBar.ts:20`'s `pb-[calc(env(safe-area-inset-bottom)+1.5rem)]` is a no-op computing to a plain 24px everywhere.
  Its own comment half-suspects this; the missing meta tag is the actual cause.
- **`SidebarTrigger` means two different things at the two breakpoints.**
  Below `sm:` it opens the drawer and is the only route to other destinations.
  At `sm:` and up the rail is already visible, so the same button is a *collapse toggle* - a screen-space gesture, not navigation.
  Any rule about "where the hamburger belongs" is therefore a mobile rule and does not transfer.
- **The topbar buttons are already 44px.**
  `CHROME_ICON_BUTTON` (`lib/chrome-controls.ts:11`) carries `touch-target`.
  `DESIGN.md:262`'s "topbar action buttons are 30px" describes the *prototype*, not production - it is not an outstanding defect, but it does bind every control this task adds.

### Every route, classified

The single most useful thing the investigation produced, because it invalidated the obvious plan.

| Route | Feed? | Reachable from the drawer? |
| --- | --- | --- |
| `/` `/archive` `/trash` | yes | yes |
| `/tag/$id` | yes | yes, via the tag list |
| `/settings/labels` | no | **yes** - it is `NAV_ITEMS[1]`, "Edit labels" |
| `/settings` | no | no, deliberately (the gear is the only entry) |

`/tag/$id` is not a child route at all - it is a peer feed scoped to a tag, and `useIsFeedRoute` already treats it as one.
`/settings/labels` is a drawer destination that merely *lives* under `/settings` in the URL.
**The only genuine child route in this app is `/settings`.**

That matters because it kills the naive version of this task.
A contextual topbar built to serve one route is a new seam threaded through the router that nobody maintains.
What justifies the seam is the editor: highest traffic, already full-screen, and already carrying the back-button bug.
Hence Step 2, without which Step 1 is over-built.

## Decisions

- **The bar is contextual, not fixed chrome.**
  The routes split cleanly into two shapes - peer feeds that need search and no back, and a settings stack that needs identity and a way up - and a fixed bar serves both badly.
  It also fixes the dead-space bug for free: on `/settings` the empty space becomes the title.
- **One rule generates most of the layout: the hamburger belongs to feed routes; every other surface gets back.**
  One predicate, testable, and it matches what Keep, Gmail and Files already taught the user.
  Two consequences are accepted knowingly rather than designed around: `/settings/labels` reached from the drawer loses the drawer (one extra tap on a rarely-visited page), and the drawer is unreachable while editing (which is the point - offering "go to Trash" mid-edit is a mistake the UI should not make).
- **Back is hybrid**: `history.back()` when `useCanGoBack()` is true, a static parent otherwise.
  Confirmed present in the installed router (`@tanstack/react-router` 1.170, `useCanGoBack` is exported).
  Pure history back exits the app on a cold deep link or a refresh.
  A pure static parent duplicates the Android system button most of the time while sometimes going somewhere *different* from it, which is worse than duplicating it exactly.
  The cost: one control with two behaviours, so the "else" branch will never be exercised by manual testing and needs a test that mounts the route cold.
- **The open note lives in the URL as `?note=<id>`, on the feed route.**
  Not a full `/note/$id` route: that buys a nicer phone editor for a lot more work - feed scroll restoration, focus-return-to-card - and a worse desktop, where Keep-style modal-over-feed is right.
  `?note=` is the same decision already recorded in `CLAUDE.md` for search state: *"Search/filter state is not in a context - it lives in the URL."*
  Which note is open is exactly that kind of state.
- **A shared `AppBar` with dumb `left` / `center` / `right` slots.**
  Same "one source, rendered twice so they cannot drift" pattern as `NAV_ITEMS` and `quickCaptureActions`.
  The slots carry no behaviour: one consumer needs a search field that flexes to fill and the other a title that truncates, so those rules live with the children.
  Slot components with two dissimilar users are how you get props soup, and this is the guard against it.
- **The quick-settings dialog is deleted.**
  It was a workaround for the missing back button - on mobile today, `/settings` is a one-way trip - and its content is a strict subset of `LanguageSection` + `AppearanceSection`.
  Once back exists the justification is gone, and one home for a setting is what makes `/settings` worth having.
  Rejected alternative: promote the theme toggle to its own mobile topbar icon.
  That makes the feed row `[hamburger][search][theme][gear]`, two 44px targets stealing from the most valuable thing in the row.
  Accepted cost: changing theme on a phone goes from two taps to three plus a navigation.
- **Titles only where the feed is ambiguous** - `/archive`, `/trash`, `/tag/$id`.
  `/` is the default surface and does not need to announce itself.
  Accepted cost: the bar changes height between feeds, so `/` → `/archive` shifts content down.
  They are different pages; that is fine.
- **The `<h1>` stays `sr-only` in the content; the topbar title is a plain `<span>`.**
  Moving the `<h1>` into the topbar would land navigation focus *above* `#main-content` and leave the skip link pointing past the heading it just focused, breaking the focus contract Slice 2.5 deliberately built.
  A screen reader hears the title once, a sighted user reads it in the bar, and the DOM duplication is invisible.
  Rejected: `aria-hidden` decoration, which would be text existing only for sighted users with no reason given.
- **Route → bar config is a pure derivation module**, `src/components/nav/topbar.ts`, sibling to `navItems.ts`.
  Route `staticData` was rejected because it is static and `/tag/$id`'s title is a live query, so config would split across two mechanisms.
  Context registration was rejected because the Navbar renders *above* the view, so a child registering config into a parent is a set-state-during-render or set-state-in-effect - the exact class of bug Slice 2.5 had to fix in `use-mobile.tsx`, and the pre-commit ESLint rule rejects it.
  The honest cost is a dependency inversion: the nav layer now knows about every route rather than each route declaring its own chrome.
  Acceptable because the route set is frozen at six.
- **Desktop is untouched**, and this is principled rather than lazy.
  Every job the mobile additions do is already done there by something else: the permanently visible rail highlights the active destination (orientation), reaches every destination in one click, and desktop keeps browser chrome an installed iOS PWA does not (back).
  `/settings` is the only route not in the rail and it renders its own visible `<h1>`.
  Adding back arrows and titles to desktop would be adding controls whose need is already met.
  Two consequences: `AppBar` is a mobile-only component, and `?note=` is *not* mobile-only and cannot be - browser back will close the editor dialog on desktop too, which is the web convention but is a behaviour change on a platform this task was not asked to change.

## The bar, state by state

| Route | Left | Row 1 | Row 2 | Right |
| --- | --- | --- | --- | --- |
| `/` | hamburger | search | - | gear |
| `/archive` `/trash` `/tag/$id` | hamburger | **title** | search | gear |
| `/settings` `/settings/labels` | **back** | title | - | - |
| editor, below `sm:` | **back** | - | - | save status |

```
FEED  /archive                       FEED  /                          SETTINGS  /settings
┌────────────────────────────┐       ┌────────────────────────────┐   ┌────────────────────────────┐
│  ☰   Archive          ⚙   │       │  ☰ ┌──────────────────┐ ⚙ │   │  ←   Settings              │
│  ┌──────────────────────┐  │       │    │🔍 Search…  ⇅  ▦ │   │   └────────────────────────────┘
│  │ 🔍 Search…    ⇅  ▦ │  │       │    └──────────────────┘   │
│  └──────────────────────┘  │       └────────────────────────────┘
└────────────────────────────┘
```

The title takes the top line because that is where the eye lands and where every other app on the phone puts it, and it keeps the search field full-bleed rather than squeezed between two icons.
`/settings` is then the same component with row 2 simply absent, not a special case.
Rejected: title *below* the controls row (reads as a caption), and a one-row bar with search collapsing behind an icon (hides the app's core action behind a tap to save 44px).

## Step 1 - `AppBar`, the derivation, back and titles - **done** (2026-08-08)

- [x] `src/components/nav/topbar.ts` - a pure function of the **pathname** to `{ kind: 'feed' | 'page', title, parent }`.
      One discriminator rather than three booleans: `kind` is literally the rule, and `showSearch` / "show the gear" / "show the trigger" were all the same predicate wearing three names.
      Unit-testable without a router, a provider or a database; the whole matrix is one table.
- [x] `src/components/ui/AppBar.tsx` - `left` / `center` / `right` and nothing else, with only "the middle grows, the sides do not" baked in.
- [x] `src/components/nav/useTopbar.ts` resolves the one title the pure function cannot: the tag name, via its own `useLiveQuery`.
- [x] `BackButton` on `useCanGoBack()` + `router.history.back()`, falling back to the parent.
      A `<button>` in both branches, not a `<Link>`: in the common case the destination is not knowable up front, and a link whose `href` is a guess offers an open-in-new-tab that goes somewhere other than the click.
- [x] `navbar.tsx`'s mobile branch rewritten onto `AppBar`; the desktop branch untouched.
      The gear and its quick-settings sheet moved into a `MobileSettingsButton` so the bar reads as a bar. Step 3 deletes it.
- [x] Editor header below `sm:`: back arrow left, save status right, vendored `X` hidden.
      Desktop keeps the `X`. **This relocates a control users have muscle memory for.**
- [x] `settings.tsx` / `labels.tsx` `<h1>` is `sr-only sm:not-sr-only`: the topbar carries the title on mobile, the heading carries it on desktop, and it stays in the DOM either way as the focus target.
- [x] Strings: `nav.back` in `en` and `cs`.
- [x] Tests: `topbar.test.ts` (full matrix + the rule stated as a rule), `AppBar.test.tsx` (slots, omitted side slots, only-the-middle-flexes), `BackButton.test.tsx` (both branches, including the cold mount manual testing never reaches), and three in `NoteEditorDialog.test.tsx`.
      812 passing, `tsc` and `check:ci` clean.

**Four things the browser caught that the tests could not.** All four are CSS or focus-order facts, and jsdom applies no cascade.

- **The editor's app bar was crushed to zero height.** `DialogContent` is a column flex box whose body is `flex-1`, so the bar was a shrinkable child: once the content overflowed it collapsed to `0px` with the arrow still in the DOM, focusable, and 0x0. Fixed with `shrink-0`, which is the consumer's job under the "layout rules live with the children" decision.
- **`DialogClose asChild` forwarded `data-slot="dialog-close"` onto the back arrow**, so the rule hiding the vendored `X` on mobile hid the arrow with it. The arrow now calls `handleClose` directly - the same path `onOpenChange` runs.
- **`[&>[data-slot=dialog-close]]` matched nothing:** the close is *written* as a direct child of `DialogContent` but does not *render* as one. Descendant (`_`), not child (`>`).
- **The arrow stole the opening focus.** It is the sheet's first focusable child, so Radix handed it the open focus and a new note opened with the caret on "leave". `onOpenAutoFocus` redirects to the title, and deliberately leaves a checklist draft alone so it does not race `Editor autoFocus` back up from the body.

Measured on a 390px touch viewport: back button 44x44 (the Touch Rule holds), and the arrow's glyph at x=24, on the same left edge as the title and body. With a mouse the button is 36px and the glyph lands at 20 - 4px further out, which is the direction to be wrong in. Both `BackButton` branches were confirmed in a real browser: a cold load of `/settings` falls back to `/`, and arriving from `/archive` in-app returns to `/archive`.

## Step 2 - The open note lives in the URL

Needs the ADR named at the top of this file.

- [ ] Extend the feed routes' `validateSearch` with `note?: string`.
      One shared validator already covers all four (`validateNoteSearch`), so this is one place.
- [ ] `NotesView` reads `editing` from the search param instead of `useState`.
- [ ] Close is **hybrid**, same predicate as Step 1's back: `history.back()` when `useCanGoBack()`, else `navigate({ search: { note: undefined }, replace: true })`.
      Not a plain replace-close.
      Trace it: on `/archive` you tap a card, history is `[/archive, /archive?note=x]`; a replace-close makes it `[/archive, /archive]`, so the user's next back press appears to do nothing.
      A dead tap on the system button is worse than the bug being fixed.
      Not a plain `history.back()` either: someone opening a shared note link cold has `?note=x` as their first entry, and back would exit the app.

Three invariants, each a bug if missed and none obvious from outside:

- [ ] **`?note=new` → `?note=<uuid>` is `replace: true`.**
      `ensureNoteId` mints the id lazily, mid-session.
      A push leaves a `?note=new` entry behind, so back opens a *second* blank draft instead of closing the first.
- [ ] **An unresolvable `?note=<id>` strips itself**, with `replace: true`, and shows the feed.
      Not hypothetical: closing an empty draft calls `purgeNote` (`NoteEditorDialog.tsx:200`), so the id you just came from is dead.
      Reachable by forward-tap or by reloading a stale tab.
- [ ] **Autosave never touches the URL.**
      Same rule Slice 2 set for the search box: text edits replace, deliberate navigation pushes.

There is no delete-from-editor case to handle: `NoteEditorBar.tsx:26` states the editor carries "colour, labels and pin, and nothing else", so archive and trash are not reachable from inside it.

- [ ] Tests: opening pushes exactly one entry; back closes; the lazy id swap replaces; a dead `?note=` self-heals; autosave leaves history alone.

## Step 3 - Delete the quick-settings dialog

- [ ] Remove the `Dialog` from `navbar.tsx:107` and its `Select` / `ThemeModeToggleButton` / "All settings" contents.
      The mobile gear becomes the same `Link to="/settings"` the desktop one already is.
- [ ] Remove `nav.allSettings` from `en` and `cs` if nothing else claims it.
- [ ] Test: the mobile gear navigates rather than opening a dialog.

## Step 4 - `viewport-fit=cover` and the real safe area

Its own step with its own device pass, deliberately last.
It is a global: it changes the layout viewport for the feed, the cards, the drawer and every dialog at once, not only the two surfaces this task edits.
Bundling it would make the rest harder to review and to revert.

- [ ] `index.html` - add `viewport-fit=cover` to the viewport meta.
- [ ] Top inset on the sticky header and on the `h-[100dvh]` editor sheet, or a back arrow can sit under the iOS status bar - precisely the surface with no system back to fall back on.
- [ ] Re-check `floatingBottomBar.ts`, which starts doing what it was written to do for the first time, and should now clear Android's gesture pill.
- [ ] Manual pass on a notched device across feed, cards, drawer, every dialog, and both densities.

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual, on a phone (no Playwright in this project):
  back on `/settings` returns where you came from, and returns to `/` on a cold load;
  `/archive` and `/tag/$id` name themselves;
  tapping a card puts `?note=` in the URL and system back closes the editor rather than navigating;
  opening a blank note and closing it leaves no ghost entry and no dead `?note=`;
  the editor's back arrow sits top-left and the save status top-right;
  the gear goes to `/settings` on both platforms;
  desktop is unchanged except that browser back now closes the editor.
- Every new control measured at 44x44 on a coarse pointer, in both densities.

## Out of scope

- A full `/note/$id` route.
  Considered and rejected above; revisit only if the phone editor needs to stop being a dialog for other reasons.
- Back arrows or titles on desktop.
- Hoisting page actions (create label, empty trash) into the topbar's right slot.
  The right slot carries the gear on feeds and nothing elsewhere; moving page actions there is a separate question about where a page's own controls live.
- Language on mobile keeps its Settings-only home.
  Desktop keeps its globe.
  This is a knowing divergence, not an oversight: desktop was scoped out.
