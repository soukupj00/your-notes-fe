# 0023 - The Tour points at Settings

- Status: Accepted (supersedes [ADR 0015](./0015-the-tour-drives-the-app-on-disposable-props.md))
- Date: 2026-10-11

## Context

ADR 0015 gave the Tour six steps: three on the Feed and the editor, three in Settings.
The first three taught what the app already teaches on screen.
The capture starts are visible controls, the card actions are permanently visible, and the editor's placeholder says "press '/' for commands".
The last step's copy said every note lives on this device and nowhere else, which Sync has since made false.
Props, the three Notes the Tour created and purged, existed only so those first three steps had something to act on.
They brought baselines in the Local Store, a sweep on every start, an exclusion in the sync engine and the one place where the app deleted a Note nobody asked it to.

## Decision

**The Tour has three steps, all in Settings, and creates nothing.**

1. Your toolbar: the Tour navigates to Settings and points at the toolbar preview.
2. Your quick starts: the quick-capture order and the side of the ＋.
3. Where your notes live: the "Storage and sync" section, saying the device comes first, a server keeps devices in step, and a zip is always available.

The Tour still drives the real app: going to Settings is its act, and leaving it is the inverse.
Everything else in ADR 0015 that is not about Props stands: the Tour is offered once, any navigation it did not make ends it, the app is `inert` while it runs, and its rules stay free of `driver.js` and React.
When the sync section renders nothing (no Storage API and no signed-in Device), step 3 shows its copy without a cutout.

## Consequences

- The Tour creates no Notes, so the Feed is as empty after the Tour as before it.
- Prop and the Purge of a Prop leave `CONTEXT.md`; only a Trashed Note is purged now.
- A reload mid-Tour leaves nothing to sweep, so the startup sweep, the baselines in `meta` and the sync engine's exclusion are gone.
  Installs that ran the old Tour may keep a stale `tourProps` row in `meta`, which nothing reads.
- The Tour no longer shows the editor, the slash menu or the wall; the app's own controls and placeholder carry those.
