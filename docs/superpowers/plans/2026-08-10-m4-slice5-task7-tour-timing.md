# M4 Slice 5 Task 7 - The Tour's timing: a step that lags, and Props the user watches leave

**Status:** in progress (2026-08-10).
Designed in a grilling session against measurements taken in a browser, not from reading the code.

**Goal:** Two ordering bugs, both of which the Tour ends up *right* about and looks wrong doing.
Step 2 narrates a beat behind the app it is driving.
The Props are purged after the app has been handed back, so the user watches three notes they did not write appear on their wall and vanish.

**Depends on:** [Slice 5](./2026-07-25-m4-slice5-onboarding.md) (the Tour itself, tasks 0-6).

**Decisions:** [ADR 0015](../../adr/0015-the-tour-drives-the-app-on-disposable-props.md) is the ground this sits on and needs no amendment - it never states a teardown order.
No new ADR: both changes are reorderings inside one function and fail the "hard to reverse" test.
`CONTEXT.md`'s **Tour** entry gained the rule the first fix comes from - *a Tour is not over until its Props are gone* - because that is a statement about the domain, not about `TourProvider`.

**Cross-cutting rules:** no timers.
Every wait added here is a DOM condition or an awaited write, per `lib/tour/waitFor.ts`.
No new strings, so `translations.test.ts` is not in play.
The Tour is verified in a real browser at both breakpoints; jsdom measures everything as 0x0 and can see none of this.

## Context

Measured on the running app, production preview and dev, at two viewports.
The numbers are the reason two of the three obvious fixes were dropped.

### Step 2 *was* a timeout, and the first diagnosis in this file was wrong

The table below is kept because the numbers are real, but the conclusion drawn from them was not.
It was taken at a window width that happened to be narrow, where the bug does not fire, and it was never controlled against the app's own baseline.
Doing that control - open a note by clicking a card, then open the same editor through the Tour, on one page with one warm module graph - gave 82 ms by hand and **3633 ms** through the Tour.
So the editor was never slow; the Tour was waiting.

**The spotlight library writes `aria-expanded="true"` onto whatever it highlights.**
`driver.js`'s highlight sets `aria-haspopup="dialog"`, `aria-expanded="true"` and `aria-controls` on the active element.
Step 1 highlights the capture bar, so from the Tour's first frame that attribute reads "open" on a bar that opens nothing - and `steps.ts` was reading exactly that attribute to decide whether the speed dial needed closing.
On the wide layout the exit therefore clicked a `div` with no handler and then waited out the **entire 3000 ms `waitFor` budget** for an attribute it did not own.
Measured: the URL did not change until 3069 ms, and the main thread was idle throughout (474 frames, median gap 7 ms, 348 ms of long tasks in 3.6 s) - nothing was computing, something was waiting.

It is width-specific, which is why it hid:

| width | what `capture` resolves to | `aria-expanded` | result |
|---|---|---|---|
| 390 px | the FAB `BUTTON`; driver stamps the `UL` (`captureDial`) instead | genuinely `true`, really flips to `false` | no stall |
| 1280 px | the bar `DIV`, which *is* what driver stamped | `true` forever | 3069 ms burnt every run |

And it cost three seconds *silently*: `waitFor` returns `null` on timeout by design, so a spent budget looked exactly like a slow step.

### The editor's own mount cost, which is a smaller and separate thing

Press Next on step 1 and the dialog element exists at ~1ms; the toolbar only gets a non-zero box much later, and `steps.ts:158` holds the whole step until it does.

| build / device | toolbar has a rect | popover moves | buttons live again |
|---|---|---|---|
| prod preview, desktop | 356 ms | 365 ms | - |
| dev, desktop | 575 ms | 602 ms | 655 ms |
| dev, 390px viewport + 4x CPU | **1242 ms** | 1363 ms | 1585 ms |

Splitting the throttled case: importing the whole `NoteEditorDialog` module graph on that same profile is **203 ms**, so roughly a fifth is module load and the remaining ~1s is TipTap and Radix mounting and painting.
No `waitFor` budget is being spent - the toolbar genuinely is not there yet.
This is the same second the app spends whenever a user opens a note.

For reference, a normal hand-opened note on the same page: **630 ms cold, 82-248 ms warm.**

**The screen is not frozen during it.**
`NotesView.tsx:140` renders a Suspense spinner, so the sheet opens at ~2ms and the user can see the app doing the thing.
What lags is the Tour's own popover, which sits on step 1's copy with both buttons disabled for a second.
That reframes the fix: not "make it faster", but "stop the Tour narrating a beat behind the app".

### The Props are purged after the app has been handed back

Timed from the last Next: **t+20ms** scrim gone and back on `/`, **t+33ms** three Prop cards painted, **t+46ms** gone.
`end()` (`TourProvider.tsx:335`) destroys driver and releases `inert`, unwinds to the Feed, and only *then* awaits the in-flight writes and sweeps.
The flash is structural, not an unlucky race - it happens every run, and on a phone with the masonry re-packing it is the most visible thing about the end of the Tour.

### Purging early is safe

`updateNote` (`useNoteActions.ts:83`) reads the row first and returns `null` when it is gone.
So purging a Prop while its editor is still open cannot resurrect it: the dialog's closing flush is a no-op, and `collectOrphans` has nothing to collect.
This is what makes sweeping *before* unwinding out of step 2 possible at all.

## Decisions taken

1. **The sweep is the Tour's last act, not the app's first one.**
   `end()` becomes: await writes, sweep, unwind, and only then drop the scrim and the `inert`.
   From steps 4 and 5 the Feed is not even mounted, so the removal is literally unseeable; from steps 1-3 it happens while the app is still dimmed and inert, which reads as the Tour taking its own dressing back.
2. **One order for both callers.**
   The watcher at `TourProvider.tsx:456` (`unwind: false`, the user's own back gesture) uses the same path; `unwind` decides only whether we walk back, not what goes first.
   The navigation has already happened by the time it fires, so the scrim is held over the page they asked for, for ~25ms.
3. **Teardown moves into a `finally`.**
   Not optional. With the sweep first, a rejected `purgeProps` would otherwise strand the user under an inert overlay with no way out.
4. **The copy leads, the cutout follows.**
   `setIndex` before the step's `enter` runs, so step 2's text is readable while the editor mounts underneath it.
5. **Blank the cutout only when the incoming target is not on screen yet.**
   A DOM condition, asked of `resolveTourTarget`, not a flag on `TourStep` and not a timer.
   Step 3's card exists before it is pinned, so its hole keeps its single slide; steps 2 and 4 blank and land late.
6. **The editor module is warmed when the Tour starts.**
   One un-awaited `import()` during step 1, which is several seconds of reading.
   Vite dedupes it with `NotesView`'s `lazy()`.
7. **The popover goes at once on Done; the scrim stays.**
   `end()` keeps its `setIndex(null)` first, so the press is acknowledged immediately and the dim lingers for the ~300ms of sweeping and walking back.

## Non-goals

- **A general idle-preload of the editor for every user.**
  Outside this bug and it touches `NotesView`.
  Surfaced instead: the first note-open costs ~1.2s on a throttled phone and ~1s of that is TipTap mounting, which every user pays, not only Tour takers.
- **Attacking the mount cost itself.**
  A separate piece of work with a much larger blast radius.
- **Any change to the five steps, their copy, or the Prop rules.**

## Tasks

### Step 1 - The sweep becomes the Tour's last act

`TourProvider.end()`.

```ts
indexRef.current = null; setIndex(null); setRunning(false);   // popover goes at once
try {
  await writesRef.current;
  await sweep(propsRef.current);                              // Feed unmounted on steps 4/5
  if (unwind) await leaveScene(from, makeStage());
} finally {
  driverRef.current?.destroy(); driverRef.current = null;
  releaseInertRef.current?.(); releaseInertRef.current = null;
}
```

Two comments become wrong and are rewritten rather than left: the "torn down before the app is put back" block at `:339`, and "Purging the Props undoes the pin anyway" at `:351`.
The second is still true but now explains something else - it is *why* `leaveScene` finds an empty `props` list and skips step 3's unpin.

**Verify:** the e2e probe below, plus a browser check that the end of the Tour has no flash at both breakpoints, from Done on step 5 and from Skip on step 3.

**Result: done.**
`pnpm test` (897), `check:ci` and `tsc` green.
Verified in Chromium with a MutationObserver probe that flags any `[data-note-feed-id]` added after driver's overlay leaves the DOM - the same probe Step 4 will formalise.

| case | painted after teardown | end state |
|---|---|---|
| Done on step 5, desktop | none | Feed empty, overlay and `inert` released |
| Done on step 5, 390px | none | same |
| Skip on step 3 (Feed on screen), desktop | none | same |
| Skip on step 2 (editor open on a Prop), desktop | none | `notes` store empty, `tourProps` empty |

The last row is the one worth keeping: purging a Prop out from under its own open editor left **nothing** behind, so the closing flush really is the no-op `updateNote`'s early return promises.
Also learned, the hard way, that a probe installed through Playwright/CDP's *init script* silently never fired here - it has to be installed into the page after load, or it reports "no flash" without having watched anything.
Step 4's spec must install it from the test body and assert it actually observed the teardown (`overlayGoneAt !== null`), or the assertion is vacuous.

### Step 2 - The copy leads, the cutout follows

`TourProvider.goTo()`.

```ts
if (changesScene(from, to)) {
  await leaveScene(from, makeStage());
  const stage = makeStage();
  const arriving = TOUR_STEPS[to].target(stage);
  if (!arriving || !resolveTourTarget(arriving)) driverRef.current?.highlight({ /* no element */ });
  indexRef.current = to; setIndex(to);
  await TOUR_STEPS[to].enter?.(stage);
}
await showStep(to);
```

Blank before swapping the copy: driver measures the popover on that blank highlight, and one frame of the old copy centred beats delaying the editor's open by a frame.
`showStep` is unchanged - its existing 3s `waitFor` is what lands the late cutout.

**Dropped** (2026-08-10).
It was designed against a 1.2-2 s hang that was mostly the `aria-expanded` stall.
Desktop is now 635 ms cold and ~250 ms warm, which is the app's own note-open cost and not something the Tour should paper over with a two-move cutout on every scene change.

### Step 3b - Closing the speed dial is no longer awaited

Step 1's exit presses the `＋` shut and moves on; only *opening* is awaited, because the dial is what driver measures as step 1's target.

**Result: done, and it is worth less than projected.**
The 430 ms this was meant to return was not all wait.
Measured at 390 px and 4x CPU, step 1 → 2:

| | before | after |
|---|---|---|
| URL changes | 430 ms | **304-314 ms** |
| dial actually gone | (before the URL moved) | 486-492 ms, i.e. *after* the navigation |
| popover reaches step 2 | 1363, 1363 ms | 1234, 1308 ms |

So the parallelism is real - the note now opens ~180 ms before the dial finishes folding - but the total moved by roughly **90 ms of 1360 (~7%)**.
The rest of that pre-navigation gap is the click's own synchronous React commit closing the popover, which not-waiting cannot avoid.

What it cost: the guarantee that a step arrives to a settled app, and a `settle()` in `steps.test.ts` (the un-awaited close leaked a pending timer into the *next* test's document, which is how the shared teardown found out).
Whether ~90 ms is worth that is a judgement call and the honest answer is "probably not" - it is recorded here so reverting it is a one-line decision rather than a re-investigation.

### Step 1b - The dial's state comes from the DOM, and a spent budget says so

**Result: done.**

Three changes, one cause.

1. **`setSpeedDialOpen` stops reading ARIA.** Two questions, each answered by what is on screen: *is there a dial at this width* is `captureToggle` resolving (a new `data-tour-toggle` on the `＋`, which only the narrow layout has), and *is it open* is `captureDial` resolving.
   ARIA on a spotlit element belongs to the spotlight; the app is asked about the app.
   `steps.ts` could have detected driver's `driver-active-element` class instead, and may not: nothing in `src/lib/tour/` is allowed to know a spotlight library exists (ADR 0015), which is what makes that folder testable at all.
2. **`waitFor` takes a `label` and warns on timeout under `DEV`.** A spent budget is always a bug - nothing retries - so it may not be silent. `waitForTarget` passes the selector automatically, so most call sites got one for free.
3. **The sweep waits for the Feed to drop the purged cards** before the scrim lifts, using the ids `purgeProps` returns and `sweep` used to discard. Gone from Dexie is not gone from the wall: the live query repaints a frame or two later, which was a hole in Step 1's fix that Step 1's own probe could not see (it flagged nodes *added* after teardown, never ones still there).

The paper app in `steps.test.ts` was modelling the dial with `aria-expanded`, which is why no unit test could have caught this; it now mounts and unmounts the dial's contents the way Radix does. A new test spotlights the wide bar the way driver does - `aria-haspopup` and `aria-expanded="true"` - and asserts the exit neither clicks nor waits.

Measured in Chromium, first run, cold:

| case | before | after |
|---|---|---|
| desktop 1280 px, step 1 → 2 | 3646 ms (URL at 3069 ms) | **635 ms** (URL at 66 ms) |
| desktop, steps 2→3 / 3→4 / 4→5 | - | 122 / 263 / 16 ms |
| 390 px + 4× CPU, step 1 → 2 | 1363 ms | 1363 ms (never had the bug) |
| `[tour] timed out` warnings, whole run | - | none |

Stale paint, re-checked at the exact frame the overlay leaves: **0 Prop cards**, and 0 for the 20-30 frames after, both for Done on step 5 and for Skip on step 3 with three Props on screen.

### Step 3 - Warm the editor while step 1 is being read

`void import('@/components/notes/NoteEditorDialog.tsx')` in `start()`, after the Props are seeded.
Costs `TourProvider` a mention of the editor's module path, which is the whole of the trade.

**Result: done, and it bought nothing measurable.**
Throttled mobile is 1363 ms either way.
The reason is that an automatic Tour starts the moment the Feed paints, so the preload races the app's own hydration instead of getting the idle seconds step 1 was supposed to give it; a *replay* from Settings is where it has time to land.
Kept because it is one line and cannot hurt, but it is not what fixed anything - and the original justification for it was part of the wrong diagnosis.

### Step 4 - Pin both orderings in the acceptance suite

`e2e/onboarding.spec.ts`, at both breakpoints.
Both assertions fail against today's code, which is the point - the current implementation ends up *right*, three frames later, so any end-state assertion passes before and after.

```ts
// 1. the flash: nothing of the Tour's is ever painted on the handed-back app
await page.evaluate(installPropPaintProbe);   // flags [data-note-feed-id] added after driver's overlay leaves
await done.click();
await expect(overlay).toHaveCount(0);
expect(await page.evaluate(() => window.__paintedAfterTeardown)).toBe(false);

// 2. no wait anywhere in a run ever spends its budget
page.on('console', m => { if (m.text().includes('[tour] timed out')) timeouts.push(m.text()) });
...
expect(timeouts).toEqual([]);

// 3. (only if Step 2 lands) the lead: step 2's copy is readable before its target exists
await next.click();
await expect(popover).toContainText(step2Title);
await expect(toolbar).toHaveCount(0);         // still mounting
```

The paint probe runs for Done from step 5 **and** for Skip from step 3, which is the case where the Feed is what the user is looking at, and it must assert **zero** Prop cards at the teardown frame rather than merely "none added after it".
The timeout guard is the one that generalises: it is the class of bug this task was, not the instance, and it only works because the run is at both breakpoints - the stall existed at one width and not the other.

## Verification

- `pnpm test` and `pnpm check:ci` and `pnpm build` green.
- `pnpm test:e2e` green at `desktop` and `mobile`, with the two new assertions.
- A browser pass at both breakpoints: no Prop is ever seen leaving, step 2's copy arrives with the sheet, step 3 still moves in one slide.
- The throttled-mobile measurement re-taken and recorded here.
