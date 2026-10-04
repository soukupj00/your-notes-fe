# M6 slice 6 - Tour trim

Branch `refactor/tour-waits`.
ADR 0022 style: plain functions, no classes, no controller extraction.

## Goal

`src/context/TourProvider.tsx` is the one file over the 500-line limit (506).
It re-implements two waits `src/lib/tour/steps.ts` already has: the wait for a target (private `waitForTarget` there) and the wait for the editor to close.
`lib/tour` exports both, and the provider and the steps share them.

## Task 1 - the exported waits

`src/lib/tour/waitFor.ts` gains two functions beside `waitFor`:

- `waitForTarget(target, { timeout?, label? })` resolves the target once it is on screen, or `null`; a spent budget names the target's selector unless a label is given.
- `waitForGone(targets, { timeout?, label })` resolves once none of the targets is on screen.

Callers:

- `steps.ts` drops its private `waitForTarget` and uses `waitForGone(['editorToolbar'])` in step 2's exit.
- `TourProvider.tsx` uses `waitForTarget` in `showStep` and in `start` (the Feed wait keeps its label), and `waitForGone` in `closeNote` and in the sweep.
  Its one remaining bare `waitFor` is the popover's `data-tour-step` wait, which is the provider's own.

Tests, in `waitFor.test.ts`: the target resolves once measured, the timeout warning names the selector or the given label (one table), `waitForGone` waits for every target, and an empty list answers without a frame.

## Task 2 - docs and gates

- Root `CLAUDE.md`, The Tour: the waiting bullet names the two waits.
- `PLAN.md`: the slice 6 record, and the M5 known gap about the file over 500 lines.
- Gates: `pnpm check:ci`, `pnpm lint`, `pnpm exec tsc -b --noEmit`, `pnpm build`, `pnpm test`, `pnpm test:e2e`.

## Review focus

- The sweep's wait used `document.querySelector` on each purged card; it now uses `resolveTourTarget`, which also treats a card with an empty rect as gone.
  `NoteFeed` mounts each card once and a leaving card only fades, so the two agree in the browser.
- `e2e/onboarding.spec.ts` fails on any `[tour] timed out` warning, so it is the gate for every wait touched here.
