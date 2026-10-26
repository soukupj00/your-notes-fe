# 0024 - A Welcome at launch, the Tour in Settings

- Status: Accepted (supersedes [ADR 0023](./0023-the-tour-points-at-settings.md))
- Date: 2026-10-21

## Context

ADR 0023 offered the three-step Tour at first launch and took the user from the Feed to Settings for it.
In the first user test the tester asked for two guides instead: one for the main page, and the current one when Settings is first opened.
Skipping the Tour also sent the tester back to the Feed, out of the Settings they had just been shown.
That was the Tour unwinding its own navigation, as ADR 0023 designed it, but it read as being thrown out.

## Decision

**Launch shows a Welcome, and the Tour waits for the first visit to Settings.**

- The **Welcome** is one overlay on the Feed: a short greeting, and two marks that each cut out a control and say what it is for, the capture bar (or the ＋ on a phone) and the Settings gear.
  It is not a Tour: nothing steps, and one press (or Esc) dismisses it.
  It is offered once, stamped in `welcomeSeenAt` when offered.
- The **Tour** keeps its three Settings steps but no longer navigates.
  The first visit to Settings offers it, stamped in `onboardingSeenAt` when offered; Done and Skip leave the user where they are, in Settings.
  "Replay tutorial" in Settings replays it in place.

What ADR 0015 and 0023 said about the Tour otherwise stands: any navigation the Tour did not make ends it, the app is `inert` while it runs, waiting is on DOM conditions and never on timers, and `src/lib/tour/` imports neither `driver.js` nor React.
The Welcome follows the same rules, and draws its cutouts itself instead of through `driver.js`, which highlights one element at a time.

## Consequences

- The Tour has no scenes left to enter and leave, so `enter`, `exit` and `continues` are gone from its steps, and so are its navigation marking and `resetScroll`.
- Two independent stamps: an install that saw the old Tour at launch still sees the Welcome once, and is not offered the Tour again.
- The Welcome's copy and its two marks are a first proposal; search was left out because on a desktop its callout would sit on the capture bar's.

## Amendment (2026-10-25): the steps point at the Settings home

Settings became a home of rows that each open a subpage (General, Editor toolbar, Quick capture, the data page, Account, Keyboard shortcuts).
The Tour is offered on the first visit to the home, not to a subpage, and its three steps point at the home's Editor toolbar, Quick capture and data rows.
The Tour still never navigates, so it cannot open a subpage to point inside it; a row names where each setting lives, and the step's copy says to open it.
The data row renders on every Device, signed in or not, so step 3 now always has a cutout; before, its section rendered nothing without the Storage API or an account, and the step showed only its copy.
