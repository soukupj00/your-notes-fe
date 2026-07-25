# M4 Slice 5 - Onboarding

**Status:** not started.

**Goal:** A short, guided first-run tutorial that highlights the app's most important features and points the user at the customisation they now have - built last, because it highlights everything the earlier phases created.

**Depends on:** Slices 1-4 (the tour highlights real, finished UI). Do this **last**.

**Cross-cutting rule:** tour copy ships `en` + `cs`.

## Context

Item 12: a first-load (or Settings-triggered) tutorial that highlights a section, shows an arrow + descriptive text, and leads to the Settings customisation. Decision (grilling): themed `driver.js` (robust spotlight/positioning/a11y, CSS-themeable) over a hand-rolled Motion tour. Trigger gated by an `onboardingSeenAt` pref (already in the Slice 1 schema).

## Tasks

### Task 1 - Themed driver.js tour

- [ ] Add dep `driver.js`; theme it (CSS) to match the Slice 4 "tactile paper" look.
- [ ] Author the step sequence highlighting the key surfaces: create/speed-dial, search (sort + tag pills), a note's lifecycle actions (pin/colour/archive/trash), tags, and **ending on Settings customisation** (toolbar/appearance) to close the loop with item 11.
- [ ] Ensure steps target stable selectors; verify responsive behaviour on mobile (drawer open where needed).

### Task 2 - Trigger + replay

- [ ] **First-load auto-start** gated by `prefs.onboardingSeenAt` (set it when the tour completes/skips, so it shows once; syncs in M5).
- [ ] **"Replay tutorial"** action in Settings to re-run on demand.
- [ ] Respect reduced-motion (driver.js transitions minimal/off).
- [ ] Tests: shows once (flag set after run), replay re-triggers, skippable.

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual: fresh profile → tour runs once, steps land on the right elements in `en` and `cs`, final step opens Settings; reload → does not re-run; Settings "Replay tutorial" re-runs it; mobile layout intact.
