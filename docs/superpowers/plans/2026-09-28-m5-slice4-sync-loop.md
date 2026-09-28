# M5 Slice 4 - The Sync Loop - Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in Device keeps its Local Store in step with the Self-hosted Server: it pushes what it owes, pulls what it missed, turns a lost race into a Conflicted Copy, answers Live Update hints, resyncs after a 410, adopts its library on first sign-in, and erases it on sign-out.

**Architecture:** Three layers, none of which knows the one above.
`src/sync/engine.ts` is one serialized `sync()` run (push, then pull) over `LocalStore` and `Remote`, plain TypeScript.
`src/sync/loop.ts` decides *when* to run it (hints, a local edit, `online`, becoming visible, a slow poll), also plain TypeScript, so both are tested without React.
`src/context/SyncProvider.tsx` starts the loop while a session exists and exposes its status.

**Spec:** [ADR 0017](../../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md), [`04-sync.md`](../../architecture/04-sync.md), `CONTEXT.md` (Sync, Live Update, Catch-up, Offline Mutation Queue, Conflict Resolution, Conflicted Copy, Tombstone), backend `PLAN.md` "Sync rules" and `src/sync/decide.ts`.

## Decisions

- **Store primitives** (both implementations, contract cases):
  - `sync.applyPage(changes, mode)` writes server rows with the server's `rev`, not owed.
    In `keep-local` mode (a pull) a row that is owed or has a pending Tombstone is left alone: the next push decides it.
    In `server-wins` mode (resolving an outcome) it overwrites and drops the pending Tombstone.
    A server Tombstone removes the row (a Note with its links and Attachments, a Tag with its links) without writing a local Tombstone, in both modes.
    Attachment metadata on a pulled Note is not applied yet: rows need bytes, which is slice 5.
  - `sync.resetClean()` drops every Note, Tag and NoteTag that is not owed, and keeps owed rows, Tombstones and every Attachment row (a Note that comes back finds its bytes; one that does not is swept as an orphan at the next start).
  - `sync.adoptAll()` owes every row, forgets every `rev`, and drops pending Tombstones (they were deletions nobody else saw).
  - `sync.pending(): Live<number>` counts owed rows plus Tombstones. It is both the Settings "queued changes" figure and the loop's "a local edit happened" trigger.
- **`Remote.pull`** pages also carry `seq`, `self` and `resume`. The stored cursor is `next`, or `resume` once caught up, and the Device never builds a URL.
  `Remote.hints?(onHint)` is the optional Live Update seam; `HalRemote` implements it with `EventSource` on the `stream` link.
- **Push** takes one `dirty()` snapshot and sends it in chunks of `MAX_BATCH` per array. Edits made during the push go in the next run.
- **Outcomes:**
  - `accepted`: `sync.applied`.
  - `conflict` on a Note: if the local Note says the same as the server's (a retried push whose answer was lost), the server row is simply taken; otherwise the local version becomes a Conflicted Copy and the server row is taken.
  - Conflicted Copy: a new Note, new id, no `rev`, owed; header `<header or Untitled> (conflict from <Device name>, <YYYY-MM-DD>)`; same Body, state, pin and colour; its Attachments cloned under new ids with the Body repointed (every Attachment keeps one owner, bytes stay write-once); the local Note's Tags plus "Conflicts", which is found by name or created on first use and syncs like any Tag.
  - `conflict` on a Tag: the server's wins and nothing is copied. A Tag is a name and a colour; keeping both would give the person two Tags called the same thing.
  - `conflict` on a Tombstone (a stale purge): the server row comes back, the Tombstone goes, and the run reports it for one "Kept the newer version" toast.
  - `gone`: the row is removed locally without a Tombstone (the server already has one); an owed Note is first kept as a Conflicted Copy, and so is one a pulled Tombstone removes.
- **Pull** repeats until `next` is absent; each page is one `applyPage`; cursor, `seq` and `lastSyncedAt` go to `meta` after it.
- **410:** `resetClean()`, cursor cleared, pull from the start once more in the same run, then push again (a second 410 from the start is an error).
- **Adopt:** when the session's Account differs from `meta`'s, `adoptAll()`, then record the Account and clear cursor and `seq`.
- **Erase on sign-out:** blocked while `pending > 0`, with the Backup export and "Sync now" offered in the dialog; otherwise `DELETE /api/session`, then `store.clear()` (which empties `meta` too).
- **Loop triggers:** a hint whose Sequence is past the stored `seq`; `pending` rising above 0 (debounced 2 s); `online`; the page becoming visible; a poll every 5 minutes. Runs never overlap: a request during a run waits for it, and requests during the wait share one follow-up run.
- **Status:** `idle | syncing | offline | error`, `lastSyncedAt`, `pending`, `syncNow()`. Offline is `navigator.onLine === false` or a `fetch` that never answered.

## Deviations and ceilings

- Pulled Attachment metadata is not applied (slice 5 brings rows with "known but not downloaded" bytes).
- The Conflicted Copy's header words are English, because the header is data that syncs to Devices in other languages.
- **Two backend gaps, found and fixed on the backend (feat/feed-resume-link):** a caught-up page had no link to resume from (a one-page library stayed at `since=0`, re-read everything and never heard a 410), and a resync from 0 answered 410 on its second page once a Tombstone was swept. Now every page carries `_links.resume`, and every `next` carries `from`, the `since` the pull began at, which the 410 check uses. The engine keeps `next ?? resume` (contract pulled at backend `7c842e6`); it resyncs at most once per run.
- The Settings storage row (carried in from M4) did not exist yet; it landed here, beside the sync status, as the root PLAN asks.
- `SyncProvider` mounts in `routes/__root.tsx`, inside the router, because its toast links to the Conflicts Tag; `Remote` reaches it through `AccountProvider`.

## Tasks

- [x] **1. Seams.** `Remote.ts` (`PullPage` `seq` and `self`, `hints?`), `HalRemote.ts`, `syncRows.ts` (`pairOutcomes`).
- [x] **2. Store.** `LocalStore.ts`, `dexie/DexieLocalStore.ts`, `memory/MemoryLocalStore.ts`, `localStore.sync.contract.ts`: `applyPage`, `resetClean`, `adoptAll`, `pending`.
- [x] **3. Fake server.** `src/test/fakeSync.ts`: the backend's rules as a table (`decide`), rows with `rev` and `seq`, paged feed, 410, hints; `fakeServer.ts` gains one cookie per client.
- [x] **4. Engine.** `src/sync/engine.ts`, `src/sync/conflictedCopy.ts`, `src/sync/engine.test.ts`.
- [x] **5. Loop.** `src/sync/loop.ts`, `src/sync/loop.test.ts`.
- [x] **6. Provider and screens.** `src/context/SyncProvider.tsx` + test, `AccountProvider` carries `remote`, `routes/__root.tsx`, `main.tsx`, `App.tsx`; `settings/SyncStatusSection.tsx`; sign-out erase in `AccountSection.tsx`; the conflicts toast.
- [x] **7. Two Devices for real.** The backend, the built PWA, two Playwright contexts, the 04-sync.md flow.
- [x] **8. Docs.** `src/data/CLAUDE.md` + `PLAN.md`, `src/context/CLAUDE.md` + `PLAN.md`, root `PLAN.md`, `04-sync.md` where it differs.

## Follow-ups decided after the first run

- An owed edit to a Note purged elsewhere becomes a Conflicted Copy (`gone` and pulled Tombstones alike).
- The loop stands still while the Tour runs, the engine leaves Prop ids out of every push, and removing a row that was never pushed writes no Tombstone, so no Prop, link or Tombstone of one reaches the server.
- `AccountProvider` re-asks the server on `online` and on becoming visible while nothing has answered.
- The PWA offline-editor gap is recorded in root `PLAN.md` "Known gaps".
