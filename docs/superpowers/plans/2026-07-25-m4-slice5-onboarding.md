# M4 Slice 5 - Onboarding

**Status:** not started.
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
| 2 | Write it | opens Prop C's editor, then opens the `/` menu | `editor-toolbar` | slash commands, inline images/audio/files/drawings |
| 3 | Your wall | pins Prop C, wall re-packs | `[data-note-feed-id="<propC>"]` | pin, colour, label; archive keeps, trash discards with an undo window; `mod+K` |
| 4 | Make it yours | navigates to `/settings` | `settings-customisation` | toolbar, capture order, thumb side, density, colour-blind palette, motion |
| 5 | It all lives here | none | `settings-local` | nothing leaves this device; install, export a zip |

Step 1 is **one step with two acts**, not two steps: there is no dial on desktop, but the idea is identical.

Step 3 targets a card by note id rather than by a `data-tour` attribute, because `NoteFeed` already stamps `data-note-feed-id={note.id}` on both the Masonry and Stack branches.

`exit()` is the inverse of each: close the `/` menu and the editor, unpin, `history.back()`.

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

Plus a colocated `*.test.ts(x)` for each of the four `src/lib/tour/` modules and for `TourProvider`.

**Modified**

| Path | Change |
|------|--------|
| `src/context/PreferencesProvider.tsx` | `tourProps` field; `onboardingSeenAt` comment |
| `src/App.tsx` | `TourProvider` into the provider chain, inside the router |
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

- [ ] `waitFor.ts`: awaits a predicate against the DOM with a bounded timeout, never a fixed delay. Reduced motion makes every duration zero, so a fixed wait is wrong in both directions.
- [ ] `steps.ts`: the five steps, each with target, copy keys, `enter()`, `exit()`, and a `stageRadius`.
- [ ] No `driver.js` import anywhere in `src/lib/tour/`. That separation is what makes any of this testable.
- [ ] Tests: each step's `enter`/`exit` round-trips the app back to the state it started in.

### Task 4 - Provider and driver adapter

- [ ] `TourProvider`: start, advance, retreat, skip, teardown; exposes `useTourActive()`.
- [ ] Auto-start gated on `hydrated && !onboardingSeenAt`, after the Feed has painted. Props are created first, so the wall is populated behind the spotlight.
- [ ] **The abandoned-Prop sweep runs at app start, not at Tour start.** Task 1 said Tour start and that is wrong: `onboardingSeenAt` is stamped at step 1, so a user who reloads mid-Tour never gets another Tour start and their three Props would live forever. ADR 0015 already says "swept on the next **load**". It belongs beside the other startup sweeps in `routes/__root.tsx`, and it is a `purgeProps` call over whatever `tourProps` holds, followed by clearing the field.
- [ ] Stamp `onboardingSeenAt` when step 1 renders.
- [ ] **Mark every direct child of `document.body` except driver's portal as `inert`** for the Tour's lifetime.
  Not just the app root: Radix portals to `body`, so the editor dialog would escape it.
  This does three jobs at once. Tab cycles inside the popover with no focus-trap library; the dimmed UI is unreachable by keyboard as well as pointer; and step 2 cannot raise the software keyboard.
  That last one is not incidental. The editor autofocuses (`NoteEditorDialog.tsx:275`, `editor.tsx:285`) and `index.html` carries `interactive-widget=resizes-content`, so without this the phone viewport halves at step 2 and the popover has nowhere to sit.
  **Verify Radix's own open-focus attempt fails quietly under `inert`** rather than warning or looping. Do this before building on it.
- [ ] Any navigation the Tour did not initiate destroys it, Props and all. Do not fight the user for the router.
  The Tour must therefore **mark its own navigations**, because several acts are navigations: step 2 opens a note (a `?note=` search param since ADR 0014) and closing it runs `history.back()`, and step 4's Back pops `/settings`.
  Without that marking the Tour destroys itself on its own second step.
- [ ] Step 4's Next awaits `navigate()` **and** the target's presence before `moveNext()`.
- [ ] Suppress `mod+K` while active: `searchInput.tsx` binds it on the document with `preventDefault` and `enableOnFormTags`, so it fires straight through a scrim.
- [ ] Esc skips, arrows go prev/next, Enter activates the focused button.
- [ ] `animate: false` and `smoothScroll: false` under `useReducedMotion()`. Reduced motion is a hard killswitch.

### Task 5 - Popover and theming

- [ ] React portalled in via `onPopoverRender`: real `Button`, real `useTranslation`, honest "n of N" counter, `aria-live="polite"` step announcement, safe-area padding.
- [ ] Scrim is ink-based and warm by day, recessed-canvas by night. **Never plain black.**
- [ ] Cutout takes a solid amber hairline ring by day and an accent glow by night. `DESIGN.md` forbids glow in the day theme and drop-shadow depth at night, so the two cannot be treated alike.
- [ ] `stageRadius` per step matches the target's own radius: 16px card, 10px control, pill for the FAB.
- [ ] Popover is a `rounded-card` surface on `--canvas-day-high` / `--canvas-night-raised`, Bricolage title, Work Sans body, 44px minimum on every control.

### Task 6 - Replay and copy

- [ ] `HelpSection` with a "Replay tutorial" row, placed **after `ShortcutsSection`** in `settings.tsx`.
  That is where the other "learn the app" surface already lives, and it leaves `PwaInstallSection` + `BackupSection` as the closing pair that step 5 spotlights.
- [ ] Replay navigates to `/` and runs the same sequence, including the hop back to `/settings` at step 4.
- [ ] Copy in `en` and `cs` under `onboarding.*`; a test asserts key parity between the two bundles.
- [ ] **Drop `allow_failure: true` from the `test:e2e` job.** It went on in task 0 so that a deliberately red acceptance test would not leave the pipeline red for the length of the slice; the moment the Tour works it is just a way to not notice it breaking.

## Open, with defaults taken

These were left open by the grilling. Each has a default recorded so implementation is not blocked; overturn any of them before starting rather than during.

- **Back may not earn its cost.** It is why every step needs an `exit()`, roughly doubling the script work. Default: keep it. If Task 3 runs long, dropping Back to Next/Skip only is the first cut to make, and it removes `exit()` entirely.
- **Prop copy** is sketched above, not written. Default: the three notes as tabled, in `en` and `cs` like all other copy.
- **`inert` under Radix** is unverified. Default: assume it works, verify in Task 4 before building on it. If Radix misbehaves, fall back to threading a no-autofocus flag through `NoteEditorDialog` for tour-opened notes.

## Verification

- `pnpm test`, `pnpm test:e2e`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual, fresh profile, across `en`/`cs`, light/dark, mobile/desktop, colour-blind on, reduced motion on:
  Tour runs once; each step's act lands on the right element; the wall holds no Props afterwards; reload does not re-run; Settings replay does.
- Notch emulation via the `--safe-*` overrides on `:root`: the popover must clear the home indicator.
- Phone check specifically: step 2 must not raise the keyboard.
