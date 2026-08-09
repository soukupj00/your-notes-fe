# M4 Slice 5 - Onboarding

**Status:** done. Tasks 0-6 landed; the acceptance suite is green at both breakpoints.
**Rewritten:** 2026-08-09, after a `/grill-with-docs` session against the finished slices 1-4.
**Decision record:** [ADR 0015 - The tour drives the app on disposable props](../../adr/0015-the-tour-drives-the-app-on-disposable-props.md).
**Glossary:** `CONTEXT.md` gained **Tour** and **Prop**, and **Purge** widened to cover both.

**Goal:** A five-step Tour that *demonstrates* the app on Props it creates and Purges, ending on the customisation Settings gained in item 11 and on the fact that the data is local.

**Depends on:** Slices 1-4. Do this **last**.

**Cross-cutting rule:** tour copy ships `en` + `cs`.

## What changed from the original plan

The original plan is superseded in five places; the reasoning is in ADR 0015.

- The Tour **acts**, it does not merely point. The user presses Next, Back or Skip and nothing else.
- It demonstrates on **Props**, because a fresh install has an empty Feed and there was literally nothing to spotlight.
- The step list dropped *search* (a visible box that renders its own `mod+K` hint) and *create* as standalone descriptions, and gained **the editor** and **"it all lives here"**.
- `onboardingSeenAt` is stamped at **start**, not on completion.
- `driver.js` is confirmed, but React is portalled into its popover rather than its markup being restyled.

An intermediate design from the same session - a persistent welcome library gated by a new `welcomeNoteSeededAt` pref, with a note-count backstop against `restoreBackup` wiping the flag - was **abandoned in favour of Props**, which dissolve that whole problem: a re-run after a restore now creates three notes and removes them again.

## Non-goals

- No interactive steps. Nothing waits on the user doing anything; a step that did would be a different concept (`CONTEXT.md`, **Tour**).
- No second tour for the editor. It is step 2 here.
- No recorded assets of any kind. See ADR 0015 for why video does not survive locale × theme × breakpoint.
- No Prop **Tags**. Step 3's copy mentions labels, but a Prop carrying a Tag would leave that Tag in the sidebar after the sweep, and purging a Tag the user may since have attached elsewhere is a strictly worse problem than not demonstrating one.
- No Prop **Attachments**. A seeded blob would ride every zip backup and M5 sync for the life of the install.

## The five steps

| # | Name | `enter()` acts | Target | Copy covers |
|---|------|----------------|--------|-------------|
| 1 | Start anything | opens the speed dial (below `sm:`); nothing on desktop | `capture` | text, list, photo, voice, drawing |
| 2 | Write it | opens Prop C's editor | `editor-toolbar` | slash commands, inline images/audio/files/drawings |
| 3 | Your wall | pins Prop C, wall re-packs | `[data-note-feed-id="<propC>"]` | pin, colour, label; archive keeps, trash discards with an undo window; `mod+K` |
| 4 | Make it yours | navigates to `/settings` | `settings-customisation` | toolbar, capture order, thumb side |
| 5 | It all lives here | none | `settings-local` | nothing leaves this device; install, export a zip |

Step 1 is **one step with two acts**, not two steps: there is no dial on desktop, but the idea is identical.

Step 3 targets a card by note id rather than by a `data-tour` attribute, because `NoteFeed` already stamps `data-note-feed-id={note.id}` on both the Masonry and Stack branches.

`exit()` is the inverse of each: close the dial and the editor, unpin, `history.back()`.

## Props

Three Notes, created at Tour start, Purged at Tour end. Deliberately mundane content: they are stage dressing, and they are gone in five clicks.

| | Header | Body | Colour | Role |
|---|--------|------|--------|------|
| A | Groceries | checklist, 3 items, one already checked | cool | shows the Checklist and Sinking; shortest card |
| B | Weekend in Brno | a paragraph plus a bullet list | base (none) | tallest card, so the wall reads as a wall rather than a grid |
| C | Ideas | one short paragraph | deep | the card step 2 opens and step 3 pins |

Three distinct palette tokens, so the colour system is legible at a glance without a step spending words on it.

Ordering falls out of the existing feed rules and needs no special handling: Membership is live so the Props arrive at once, Rank is held so nothing jumps under the user, and Pinning is the documented exception (ADR 0012), which is exactly why step 3's pin reads as direct manipulation.

## Data

`src/context/PreferencesProvider.tsx`:

- `onboardingSeenAt` (already in the schema). Behaviour unchanged in shape, changed in meaning: stamped when step 1 renders. Its doc comment becomes **"when the Tour was first shown"**.
- **New** `tourProps: z.array(z.object({ id: z.string(), updatedAt: z.string() })).catch([]).default([])`.
  The Props currently on the wall, each with the `updatedAt` the Tour last left it at.
  It lives in the preferences blob rather than React state so a reload, crash or closed tab mid-Tour leaves something to sweep on the next start.
  It stores `updatedAt` rather than bare ids because the Tour's own acts write: pinning bumps `updatedAt` and step 2 opens the editor, so a baseline taken at seed time would make every Prop look user-edited and nothing would ever be swept.
  `.catch([])` for the same field-level-absorber reason as `colorBlind` and `toolbar`, and no `PREFERENCES_VERSION` bump, since it is a new optional field with a default.

No Dexie schema change. Props are ordinary `notes` rows.

## File manifest

**New**

| Path | Holds |
|------|-------|
| `src/lib/tour/props.ts` | `createProps`, `rebaseProp`, `purgeProps`, `sweepAbandonedProps` |
| `src/lib/tour/targets.ts` | target keys, the visibility-aware resolver |
| `src/lib/tour/steps.ts` | the five steps as data plus their `enter`/`exit` |
| `src/lib/tour/waitFor.ts` | await-a-DOM-condition helper (never a timer) |
| `src/context/TourProvider.tsx` | lifecycle, `driver.js` adapter, `inert`, navigation ownership, `useTourActive()` |
| `src/components/tour/TourPopover.tsx` | the React portalled into driver's popover |
| `src/components/settings/HelpSection.tsx` | the "Replay tutorial" row |
| `playwright.config.ts`, `e2e/onboarding.spec.ts` | the acceptance test |

Plus a colocated `*.test.ts(x)` for each `src/lib/tour/` module and for `TourProvider`.

Two files arrived that the manifest did not name, both because logic moved *out* of the provider to where it could be tested: `src/lib/tour/inert.ts` (the body-inert rule, with the driver-specific exemption injected) and `src/i18n.test.ts` (bundle key parity).
`TourProvider.test.tsx` is deliberately thin as a result - jsdom measures every element as 0x0, so no step can be shown there at all, and what is left to it is the startup sweep and `useTourActive()`'s tolerance of no provider.

**Modified**

| Path | Change |
|------|--------|
| `src/context/PreferencesProvider.tsx` | `tourProps` field; `onboardingSeenAt` comment |
| `src/routes/__root.tsx` | `TourProvider` around `Layout` - **not `App.tsx`**, which is outside `RouterProvider`, and the Tour navigates |
| `src/pages/settings.tsx` | `HelpSection` after `ShortcutsSection` |
| `src/components/searchInput.tsx` | AND `useTourActive()` into the `mod+K` `enabled` |
| `src/components/notes/QuickCaptureBar.tsx`, `DesktopCaptureBar.tsx` | `data-tour="capture"` |
| `src/components/editor/toolbar/EditorToolbar.tsx` | `data-tour="editor-toolbar"` |
| `src/pages/settings.tsx` | `data-tour="settings-customisation"` / `data-tour="settings-local"` as wrappers (see task 2 for why not on the sections themselves) |
| `src/styles/globals.css` | scrim and cutout tokens |
| `public/locales/{en,cs}/translation.json` | `onboarding.*` |
| `package.json` | `driver.js`; `test:e2e` script |
| `.gitlab-ci.yml` | replace the "Playwright remains deferred" comment at line 77 with a real job |

## Tasks

Ordered by dependency. Task 0 first because `CLAUDE.md` mandates the acceptance test before a user flow, and this is the most flow-shaped work in M4.

### Task 0 - Wire Playwright, write the acceptance spec red

- [x] `playwright.config.ts`, `pnpm test:e2e`, `e2e/` excluded from Vitest's include glob (it always was - Vitest includes `src/**` only).
  Two projects, desktop and mobile, because step 1 branches on the breakpoint.
  It runs against `pnpm dev` rather than `preview`: `VitePWA` declares no `devOptions`, so dev serves no service worker, and a service worker choosing when to hand back a cached bundle is the last thing an acceptance suite needs.
- [x] `.gitlab-ci.yml`: an `test:e2e` job in the existing `test` stage, replacing the deferral comment.
  It carries `allow_failure: true` **for the length of this slice only** - see task 6.
  It also cannot use the shared `*pnpm-setup`: `node:22-alpine` has neither the browsers nor their system libraries, so the job runs on `mcr.microsoft.com/playwright`, whose tag has to be kept in step with `@playwright/test`.
- [x] `e2e/onboarding.spec.ts`, failing: fresh profile runs the Tour once; three Props appear and are gone at the end; Skip works; reload does not re-run; Settings replay does.
  Verified red for the right reason - the page snapshot in the failure shows the whole app rendered and only the popover missing.
  Also `tsconfig.node.json` now includes `e2e/`, `playwright.config.ts` and `vitest.config.ts`, none of which any project was typechecking.
- [x] Rationale to keep in the file: jsdom returns zeroed rects, so the spotlight's only real failure mode, a hole cut over nothing, is invisible to Vitest.
- [x] The spec pins two things the plan had not settled, both recorded in its header comment: the popover is addressed by `data-testid="tour-popover"`, and Props are found by **text rather than by role**, because `inert` takes its subtree out of the accessibility tree and a note card under the scrim is therefore not a button.

### Task 1 - Props

- [x] `createProps()` writes the three rows above via `createNote` and records `{ id, updatedAt }` into `tourProps`.
- [x] `rebaseProp(id)` re-reads `updatedAt` and updates the baseline. **Every act that writes to a Prop calls it.**
- [x] `purgeProps()` uses the existing `purgeNote(id)` from `useNoteActions`, which already means exactly what `CONTEXT.md` says Purge means. Purge only Props whose current `updatedAt` still matches the baseline; leave the rest and clear them from `tourProps` regardless.
- [x] ~~`sweepAbandonedProps()` runs at Tour start against whatever the last run left behind.~~
  **Not a separate function.** The start-of-run sweep and the end-of-run teardown are the same question asked of the same list, so they are the same `purgeProps` call; the only difference is which run left the list behind.
- [x] Tests: created and purged; a **user**-edited Prop survives; a **Tour**-edited Prop is still purged (the regression this whole design exists to prevent); an abandoned run is swept on the next start; a Prop the user deleted themselves does not break the sweep.

Landed as `src/lib/tour/props.ts` + `props.test.ts`, with the `tourProps` field and the `onboardingSeenAt` comment in `PreferencesProvider.tsx` and the Prop copy under `onboarding.props.*` in both bundles.
The functions take `createNote`/`purgeNote` as arguments and *return* the new baselines rather than persisting them, so the module is callable with no React and no preferences plumbing; `TourProvider` (task 4) owns both halves.

### Task 2 - Targets

- [x] `data-tour` attributes per the manifest; names owned by `targets.ts`. Three of the five placements moved, each for a reason worth keeping:
  - **`capture` sits on the `＋` button, not on `QuickCaptureBar`'s wrapper.** The wrapper is a full-width bar pinned to the bottom edge, so a cutout over it would be a letterbox across the screen rather than a circle round the button. The desktop twin keeps the attribute on the whole bar, because there the bar *is* the affordance.
  - **The two Settings targets are declared in `settings.tsx`, wrapping their sections**, rather than inside `EditorToolbarSection` / `PwaInstallSection`. No section then has to know the Tour exists, both anchors are legible in one place, and a step points at a block of related rows rather than at one of them. A bare `div` around `<section>`s changes no layout.
  - **`settings-local` wraps `PwaInstallSection` *and* `BackupSection`, and would be `BackupSection` alone if it had to choose.** `PwaInstallSection` returns `null` unless the browser is offering an install - which it is not once installed, not on desktop Firefox, and not in a headless browser - so as the sole anchor it would drop step 5 for most users. Step 5 carries the one fact whose absence can cost somebody everything they have written; it may not be the step that goes missing.
- [x] Resolver returns the first match with a **non-zero client rect**.
  Not optional: `DesktopCaptureBar` is `hidden sm:flex` and `QuickCaptureBar` is `sm:hidden`, so both are always mounted and a naive `querySelector` matches the invisible one on one of the two breakpoints. `searchInput.tsx` has the same duplication.
- [x] Resolver also accepts a dynamic selector, for step 3's `[data-note-feed-id="<id>"]` (`noteCardTarget(id)`, `CSS.escape`d).
- [ ] ~~Steps whose target does not resolve are dropped **before** `drive()`~~ - **moved to task 3**, where the step list exists. `resolveTourTarget` returning `null` is the mechanism and it is documented as a normal answer; writing the filter here would have meant a generic over a step type that does not exist yet.
- [x] Test: ~~every step's target resolves at both breakpoints in a rendered app.~~ **Split, because half of it is not answerable in jsdom.**
  jsdom applies no CSS and measures every element as 0x0, so `hidden sm:flex` and `sm:hidden` are indistinguishable there and `resolveTourTarget` returns `null` for both members of a pair. So:
  - `targets.test.ts` covers the resolver's logic against rects it stubs itself - picks the measured one of a pair, first-in-document-order among equals, `null` when all are hidden, dynamic selectors, a scoped root.
  - `targets.mounted.test.tsx` is the drift guard: every name in `TOUR_TARGETS` is on something in a rendered app (and `capture` is on exactly two things, which is what makes the rect check load-bearing), plus a test that fails when a target is added and nothing checks it.
  - The breakpoint half belongs to the acceptance suite, which already runs `desktop` and `mobile` projects.

### Task 3 - The script

- [x] `waitFor.ts`: awaits a predicate against the DOM with a bounded timeout, never a fixed delay. Reduced motion makes every duration zero, so a fixed wait is wrong in both directions.
  Polls per animation frame, because what is nearly always being waited on is a *rect*, and a rect is only true after the browser has laid out.
  It returns `null` on timeout rather than throwing: a step that cannot find its target still has copy worth reading.
- [x] `steps.ts`: the five steps, each with target, copy keys, `enter()`, `exit()`, and ~~a `stageRadius`~~ **`stageRadiusOf(element)`**.
  A number per step cannot be right: step 1 points at a 28px circle on a phone and a 16px card on desktop, and it is one step.
  Reading the target's own computed `border-radius` is shorter, self-maintaining, and needs the clamp anyway - Tailwind's `rounded-full` computes to a near-infinite length that no cutout path can use.
- [x] **Step 2 no longer opens the `/` menu.** Settled 2026-08-09: it opens Prop C's editor, spotlights the toolbar, and the copy says `/` reaches the same list.
  Keeping the act meant threading a live TipTap instance out through `NoteEditorDialog` purely for the Tour, writing a character into a Prop and undoing it on the way back - and the menu renders at the caret, which is inside the scrim and outside the cutout the step had just cut over the toolbar.
- [x] ~~Steps whose target does not resolve are dropped **before** `drive()`~~ - **not implementable, and it was never the right shape.**
  Three of the five targets do not exist when a run starts: the editor toolbar is created by step 2's own act, and both Settings blocks by step 4's.
  A pre-flight filter could therefore only ever have asked about step 1, which is also the one target that is always there.
  What replaces it: each step's `enter` awaits its target through `waitFor`, and a step that still has none is shown centred with no spotlight (`stageRadiusOf(null)` is the card radius, and task 4 hands driver no element).
  The counter's honesty, which is what the drop rule existed for, is safe because the two steps that *could* be dropped - `settingsLocal` for a missing install prompt, step 3 for a missing Prop - are both already answered: task 2 moved the anchor to `BackupSection`, which always renders, and a run with no Props acts on nothing rather than failing.
- [x] No `driver.js` import anywhere in `src/lib/tour/`. That separation is what makes any of this testable.
- [x] Tests: each step's `enter`/`exit` round-trips the app back to the state it started in.

Landed as `waitFor.ts` + `steps.ts` with colocated tests, plus `propByKey` in `props.ts`.
The steps act through a `TourStage` handed to them - `openNote`/`closeNote`, `pinProp`/`unpinProp`, `navigate`/`back` - so no step reaches for a hook, and none of them *can* forget to rebase a Prop, because the stage's writers are the rebasing ones.
Everything else a step needs it reads from the document: `steps.test.ts` runs the five against a paper app of divs carrying the same `data-tour` names, which is enough to pin every act's inverse.
Step 1's two acts are one act - it clicks the resolved `capture` element, and a missing `aria-expanded` is how it knows this width has no dial to open.

### Task 4 - Provider and driver adapter

- [x] `TourProvider`: start, advance, retreat, skip, teardown; exposes `useTourActive()`.
- [x] Auto-start gated on `hydrated && !onboardingSeenAt`, after the Feed has painted.
  The "after the Feed has painted" gate is a `waitFor` on the `capture` target, and it is load-bearing twice over: it is also what keeps the Tour out of an environment that never paints a Feed, which is every jsdom test that renders a route.
  **It does not navigate.** Only a *replay* moves the user to `/`; someone who opened the app straight into Settings asked to be there, and the Tour is offered the next time they are on the wall it is about.
- [x] **The abandoned-Prop sweep runs at app start** - but inside `TourProvider`, not in `routes/__root.tsx` as this plan said.
  The provider is mounted by the root route, so it *is* app start; what putting it in `__root.tsx` would have cost is the ordering. The sweep and the seed are the same list, and running them from two components races a fresh seed against the old list's purge.
- [x] Stamp `onboardingSeenAt` when step 1 renders - **before the Props are seeded, not after**.
  The three notes land on the wall the instant they are written, and the acceptance suite caught the window: a reload between the seed and the stamp re-armed the Tour, which then seeded three more on top of the three it had orphaned.
- [x] **Mark every direct child of `document.body` except driver's portal as `inert`** for the Tour's lifetime.
  Landed as `src/lib/tour/inert.ts` (with its own tests) rather than inside the provider: it is a DOM rule with no React in it, and the exemption is passed in as a predicate so nothing in `src/lib/tour/` has to know which spotlight library is running.
  ~~**Verify Radix's own open-focus attempt fails quietly under `inert`**~~ **Verified 2026-08-09**, in Chromium at both projects' viewports - `document.activeElement` stayed on `<body>`, nothing was focused inside the dialog, typing did not reach the editor, and neither Radix's `FocusScope` nor TipTap logged anything at all.
  The same probe settled that **a programmatic `.click()` still runs its React handler inside an `inert` subtree**, which is how step 1 opens the speed dial.
- [x] Any navigation the Tour did not initiate destroys it, Props and all, and the Tour marks its own so it does not destroy itself on its own second step.
- [x] Step 4's Next awaits `navigate()` **and** the target's presence before showing the step.
- [x] Suppress `mod+K` while active, through `useTourActive()` in `searchInput.tsx`.
- [x] Esc skips, arrows go prev/next, Enter activates the focused button.
- [x] `animate: false` and `smoothScroll: false` under `useReducedMotion()`.

Three things this task ran into that the plan had not foreseen, all of them found by the acceptance suite or by looking at the result:

- **A step is a scene, not a layer.** The app's state between steps is not additive - step 2's editor covers the wall step 3 points at - so a move is `exit` the step being left, then `enter` the one arriving, in *both* directions. Steps 4 and 5 are the exception: they are Settings looked at twice, so step 5 carries `continues` and stepping between the pair does neither. `changesScene` and `leaveScene` live in `steps.ts` beside the list they reason about.
- **The Tour's own presses must stop at the popover.** Radix's dismissable layers listen on the document for a pointer "outside" themselves, and the popover is outside every one of them: pressing Next while step 2's editor was open made Radix close that dialog *as well*, so the step's `history.back()` and Radix's landed as two pops and the second left the app entirely. The popover swallows `pointerdown`/`mousedown`/`touchstart`/`focusin`, which is also the true statement - nothing on that surface is an interaction with the app underneath.
- **The popover host carries `aria-live="off"`.** A modal Radix dialog marks every other child of `body` `aria-hidden`, and the library it uses keeps `[aria-live]` elements deliberately - so this is its supported way of saying "not this one". Without it the popover's buttons left the accessibility tree the moment the editor opened: visible, clickable, and unreachable by name.

### Task 5 - Popover and theming

- [x] React portalled in via `onPopoverRender`: real `Button`, real `useTranslation`, honest "n of N" counter, `aria-live="polite"` step announcement, safe-area padding.
  The React is rendered into a host of our own and *appended* into driver's popover rather than rendered into it, because driver positions the box the moment `onPopoverRender` returns and a tree committed at that instant would still be empty.
- [x] Scrim is ink-based and warm by day, recessed-canvas by night. **Never plain black.**
  Passed as `overlayColor: 'var(--tour-scrim)'`: driver writes it into the overlay path's inline `style.fill`, where a `var()` resolves like anywhere else - so the two scrims switch with the theme and no stylesheet has to out-specify an inline style.
- [x] Cutout takes a solid amber hairline ring by day and an accent glow by night, drawn on the spotlit element itself. Not a stroke on the overlay path: that path outlines the viewport as well as the hole, so stroking it would frame the whole screen.
- [x] `stageRadiusOf` per step matches the target's own radius.
- [x] Popover is a `rounded-card` surface on the popover plane, Bricolage title, Work Sans body, 44px minimum on every control.

Two defects found by looking at the result rather than by a test, both about *when* driver measures:

- **Driver measures the popover exactly once and never looks again.** Handed a box a beat early it measured an empty one, decided the popover was 0px tall, and put step 1 half off the top of the window and on top of the very control it was pointing at. `TourPopover` now stamps `data-tour-step`, and the provider waits for that to match before handing driver anything.
- **The typefaces are self-hosted and load async**, so a popover measured mid-swap is measured in the fallback face. `start()` awaits `document.fonts.ready` before the first step.

Step 1 also changed target below `sm:`. The `＋` was the wrong thing to cut a hole over once the dial was open: the five starts unfold *above* the button, so the step's copy was about five things sitting under the scrim, two of them behind the popover. There is now a `captureDial` target on the dial's own list, and step 1 points at whichever of the two is on screen - which above `sm:` is still the bar, because there the bar *is* the five starts.

### Task 6 - Replay and copy

- [x] `HelpSection` with a "Replay tutorial" row, placed **after `ShortcutsSection`** in `settings.tsx`.
- [x] Replay navigates to `/` and runs the same sequence on a fresh set of Props, including the hop back to `/settings` at step 4.
- [x] Copy in `en` and `cs` under `onboarding.*`, plus `settings.help.*`.
  `src/i18n.test.ts` asserts key parity between the bundles and that every step's built key (`onboarding.steps.<step.key>.*`) resolves in both - the Tour's keys are composed at render time, so renaming a step is a rename in three files and nothing else would notice.
  Parity is compared on *base* keys: plural suffixes are not the same set in every language (Czech needs `_few`).
- [x] **Dropped `allow_failure: true` from the `test:e2e` job.**

## Open, with defaults taken

These were left open by the grilling. Each has a default recorded so implementation is not blocked; overturn any of them before starting rather than during.

- ~~**Back may not earn its cost.**~~ **Kept, and it paid for itself twice over.** `exit()` turned out not to be Back's cost at all: because a step is a scene rather than a layer, the forward move needs the same inverse. Dropping Back would have saved nothing.
- ~~**Prop copy** is sketched above, not written.~~ **Written, as tabled, in `en` and `cs`.**
- **Step 4's reach.** Its copy originally promised density, the colour-blind palette and motion, which live in `AppearanceSection` two sections above the cutout with `LabelsSection` in between. **Settled 2026-08-09: narrow the copy, do not reorder the page.** Step 4 promises only what is inside its spotlight - the toolbar, the capture order and the thumb side - and the step table above has been corrected to match.
- ~~**`inert` under Radix** is unverified. Default: assume it works, verify in Task 4 before building on it. If Radix misbehaves, fall back to threading a no-autofocus flag through `NoteEditorDialog` for tour-opened notes.~~
  **Closed 2026-08-09: it works, and quietly.** Details in task 4.

## Verification

- `pnpm test`, `pnpm test:e2e`, `pnpm tsc -b --noEmit`, `pnpm check:ci` - all green.
  The acceptance suite runs the six specs at both breakpoints: the Tour runs once on a fresh profile, demonstrates on three Props, purges them on Done and on Skip, retreats without ending, does not re-run after a reload (and sweeps what that reload abandoned), and replays from Settings.
- Looked at, at both breakpoints in both themes, every step: the scrim, the cutout's ring and glow, the popover's placement and its copy.
  That pass is where three of this slice's defects came from, none of which a test would have reported - a popover measured before its own content existed, a scrim that stayed plain black because driver writes its fill inline, and a step 1 whose spotlight was on the button rather than on the five things its copy names.
- Phone check: step 2 raises no keyboard, which is `inert` doing its third job.

Still owed, and not blocking: a manual pass in `cs`, with the colour-blind palette on, with reduced motion on, and with the `--safe-*` overrides on `:root` standing in for a notch.
