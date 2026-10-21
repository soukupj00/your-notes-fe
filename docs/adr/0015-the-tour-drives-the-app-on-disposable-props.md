# 0015 — The tour drives the app on disposable props

- Status: Superseded by [ADR 0023](./0023-the-tour-points-at-settings.md)
- Date: 2026-08-09

## Context

M4 item 12 asks for a first-run tutorial that highlights a section, points at it, and leads the user to the customisation Settings gained in item 11.
The slice plan settled on a themed `driver.js` spotlight over a hand-rolled one, and left the rest as a list of surfaces to point at.

Grilling that plan against the finished app found three problems, in ascending order of how much they change the design.

**There is nothing on screen to point at.**
On a genuinely fresh install the Feed is empty: `NoteContent.tsx` renders the `notes.empty.active` block, and nothing seeds the database.
The plan's step highlighting "a note's lifecycle actions (pin/colour/archive/trash)" would cut a spotlight over a blank canvas.
The same emptiness makes the wall, the pin re-pack and the Masonry/Stack switch - three of the system's most distinctive behaviours per `DESIGN.md` - invisible on the one screen that forms a first impression.

**The plan spends its steps on the obvious and omits the dangerous.**
Three of five steps cover creating, searching and acting on a note.
All three are announced by visible controls: the capture bar is on screen, the search box renders its own `mod+K` hint, and card actions are permanently visible rather than hover-revealed (`NoteCard.tsx` gates only decorative scale and shadow on hover).
Meanwhile nothing tells a new user that their notes live **only in this browser**, which is the one fact whose absence can cost them everything they have written when they clear site data or change machines.

**A tour of the feed teaches the frame, not the picture.**
The editor is where most of this app is: the slash menu, inline images, audio, video, files, Excalidraw drawings, checklists, and a toolbar customisable per Width Class.
A tour that never opens a note skips all of it.

Underneath all three sits a harder question: should onboarding *describe* the app or *show* it?
Showing it is what users actually retain, and the conventional way to show it is recorded video.
That does not survive contact with this app.
A clip bakes in the UI language, the theme and the aspect ratio, so covering `en`+`cs` × light+dark × mobile+desktop is eight recordings per step, forty in the bundle of an offline-first PWA, all of which rot the next time a control moves.
It also cannot show the user their own theme, which is the entire "changes its light" thesis of `DESIGN.md`.

## Decision

**The Tour drives the real app, demonstrating on Props it creates and Purges.**

Each step performs the gesture it is describing - opens the speed dial, opens a note, pins a card and lets the wall re-pack, navigates to Settings - while the user only presses Next, Back or Skip.
Nothing autoplays and no step waits on the user.

### Props are what make this safe

A puppet tour driving real user data would be unacceptable: it would pin, colour and open notes somebody cares about.
So the Tour creates three Props (`CONTEXT.md`) at start and Purges them at end, and acts only on those.
Pinning a Prop, colouring it, opening it - all of it mutates nothing the user owns, and all of it is undone by the sweep.

Three rules make the sweep safe in turn:

1. **It purges, it does not trash.** A Prop that went to Trash would leave the user with three mystery notes to discover and clear, which is worse than never sweeping at all.
2. **An edited Prop is not a Prop.** The moment a Prop holds the user's writing it is theirs, and the sweep leaves it.
3. **Orphans are swept on the next load.** A reload or a closed tab at step 2 ends the Tour with no teardown, so the Props live in the preferences blob rather than React state, and the next start sweeps whatever the last run abandoned.

Rule 2 needs care, because the naive version of it is wrong.
Comparing `updatedAt` against what the Tour *seeded* fails immediately: step 3 pins a Prop and step 2 may type into one, so by teardown every Prop looks edited and nothing would be purged - producing exactly the litter Props exist to prevent.
So the Tour owns the baseline rather than the seed doing: `tourProps` stores `{ id, updatedAt }` and the Tour re-records `updatedAt` after each of its own acts.
The sweep purges only Props still matching the baseline the Tour itself last set, which stays correct however freely the acts write and however many steps are added later.

### Nothing is recorded, so nothing can rot

Because the Tour *is* the app, it is automatically in the right Locale, Theme, Vision Mode, density and Width Class, and it cannot describe a button that has moved.
This is the property that recorded video cannot have at any price.

### The script is separable from the spotlight

The step list, its `enter`/`exit` acts, the seeding and the sweeping are plain units with no `driver.js` in them; `driver.js` is a thin adapter behind them.
This is not speculative decoupling - it is what makes the feature testable at all, since jsdom returns zeroed rects and cannot see the spotlight's only real failure mode.

`driver.js` itself is confirmed rather than reopened.
It cuts a hole in an **SVG overlay** (the overlay takes `pointer-events: none`, the target takes `pointer-events: auto`) instead of raising the target's `z-index`.
That matters concretely here: every masonry card is an `m.li` carrying an x/y transform and therefore its own stacking context, so a `z-index`-based spotlight - which is what a naive hand-roll reaches for - would leave the highlighted card dimmed underneath the scrim.

Two gaps are patched rather than lived with.
`driver.js` renders its own popover markup, so React is portalled into it through `onPopoverRender`, giving the real `Button` component, real `useTranslation`, an honest "3 of 6" counter, an `aria-live` step announcement, and safe-area padding its own positioning engine knows nothing about.
And because no step needs the user to touch the app, everything is marked `inert` for the Tour's lifetime - every direct child of `document.body` except the popover's own portal, rather than just the app root, since Radix portals to `body` and the editor dialog would otherwise escape it.
That earns its keep three times over: Tab cycles inside the popover with no focus-trap library, the dimmed UI is unreachable by keyboard as well as pointer, and the software keyboard cannot rise during the editor step.
The last is the one that would otherwise have hurt.
The editor autofocuses and `index.html` carries `interactive-widget=resizes-content`, so on a phone step 2 would halve the visual viewport and leave the popover fighting the toolbar it is pointing at for the remainder - on the app's primary platform.

### Acts await state, never timers

Reduced motion is a hard killswitch in `DESIGN.md`, so every duration in the app can be zero.
A step that waits 300ms for the speed dial is wrong in both directions.
Each `enter()` awaits the DOM condition it actually needs.

### The Tour is offered once, not until finished

`onboardingSeenAt` is stamped when step 1 renders, not on completion.
The fact worth recording is that the Tour was *offered*; a flag stamped on completion re-arms after every reload, crash, closed tab and back button, and a tutorial that reappears after you dismissed it is the most irritating thing this feature can do.
Settings' "Replay tutorial" is the deliberate way back in.

Any navigation the Tour did not itself initiate destroys it.
A user who presses back has left; the Tour does not fight them for the router.

## Consequences

- **The app creates notes the user did not ask for**, briefly. This is the surprising part and the reason this ADR exists. It is bounded by the Prop rules above: three notes, purged at the end, never touching anything edited.
- **The Feed is empty when the Tour ends.** The cold-start blank screen is deferred by a few minutes rather than removed. The empty-state copy already handles it.
- **Props carry no Tags and no Attachments.** A Prop's Tag would outlive the sweep and sit in the sidebar, and purging a Tag the user may since have attached elsewhere is a worse problem than not demonstrating one; a Prop's Attachment would be a blob riding every zip backup and M5 sync for the life of the install. Step 3 therefore mentions labels in copy without showing one.
- **A step can act on state the user then keeps.** A Prop the user edits mid-tour survives the sweep and stays on their wall, which is correct but means "three notes appear then vanish" is not universally true.
- **Steps are ordered dependencies, not a list.** Step 4 leaves the Feed for `/settings`, so the sequence can no longer be reordered freely, and Back must undo an act rather than just decrement an index.
- **Playwright gets wired in this slice.** `CLAUDE.md` mandates an acceptance test before a user flow, and this is the most flow-shaped work in M4; jsdom cannot see a hole cut over nothing. The tour's spec is the first one, and M5 sync inherits the harness.
- **`CONTEXT.md` gained two terms and Purge widened.** Purge previously meant only the end of the Trash lifecycle; a Prop is purged from Active, immediately, with no grace period.

## Alternatives considered

**A welcome library the user keeps.**
Rejected in grilling, in favour of Props.
Seeded notes that persist solve the empty-canvas problem and then hand the user a cleanup chore on their first day, and they force every step's target to be defensive about a note that may have been deleted months ago.

**Recorded video or GIF per step.**
Rejected. The combinatorial cost above (locale × theme × breakpoint), the bundle weight in an offline-first PWA, and the certainty of rot.

**A synthetic animated replica in the popover.**
Rejected. It is a second UI to maintain in parallel with the real one, guaranteed to drift, and it asks the user to watch a cartoon of an application that is sitting directly behind it.

**A static spotlight tour that only describes.**
Rejected as the weakest form of the feature, and the one users are known to click through. If the Tour is worth building at all, its job is disclosing what is *not* discoverable - the customisable toolbar, the reorderable capture starts, the colour-blind palette, and the fact that the data is local - and describing those in a caption is what the Settings page already does.

**Hand-rolling the spotlight on `@floating-ui/dom` + Radix + Motion.**
Rejected, though all three are already dependencies. The SVG cutout is the genuinely hard part and `driver.js` solves it correctly in 5kb; the portalled popover recovers the component fidelity and accessibility that were the only real arguments for hand-rolling.
