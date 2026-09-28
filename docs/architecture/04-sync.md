# Sync

The M5 synchronization design.
Decided 2026-08-12; the conflict model is [ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md), the deployment/auth frame is [ADR 0018](../adr/0018-the-server-serves-the-pwa.md) ([05-server.md](./05-server.md)).
Glossary terms (Revision, Conflicted Copy, Tombstone, Offline Mutation Queue) are canonical in [`CONTEXT.md`](../../CONTEXT.md).

## The problem

Two devices can edit the same Note while one is offline.
The Body is the thing actually fought over: it is one HTML string, and every richer element (attachments, checklists) lives inside it.
So any strategy that merges `header`, `color` and `state` field-by-field has not touched the real conflict.

## The model: note-level last-writer-wins, losers kept

**The server holds a Revision per synced thing.
A push carrying a stale Revision is rejected; the server's version becomes the Note, and the device's version is kept beside it as an ordinary Note - a Conflicted Copy.**

Sync never discards anything a user wrote.
Resolving a conflict is a person reading two Notes and deleting one - never something the app does silently.
A Conflicted Copy is surfaced, not hidden: it gets a "Conflicts" Tag and a header naming its origin device and date, which makes the existing `/tag/$id` screen the review surface at no extra cost.
The honest cost of the model: concurrent edits to one Note lose no text but produce a duplicate - a failure mode a user can understand and repair.

### Revision boundaries

| Synced thing | Own Revision? | Why |
|---|---|---|
| Note (incl. its attachment *metadata*) | Yes | The aggregate; an Attachment belongs to exactly one Note and has no independent life |
| Tag | Yes | Independent life by definition |
| NoteTag link | Yes | Deliberately bought granularity: typing into a note on the laptop while tapping "+ Label" on the phone must not produce a duplicate card - labelling must never conflict with writing |
| Attachment bytes | No | Write-once by id (the one rewriter, Excalidraw save, is refactored to mint a new id), so transfer is an idempotent `PUT` with no conflict rule possible |

### Deletions: Tombstones

Trashing is a `state` field update ([ADR 0009](../adr/0009-note-lifecycle-model.md)) and syncs as an ordinary edit, undo window included.
A Tombstone is written only by a Purge, so genuine deletions are rare and mostly machine-generated.
A Tombstone carries the `rev` the Device last agreed with, and a stale purge answers `conflict`, so a purge never discards a newer edit.
Tombstones expire on the server after 90 days; a device whose cursor predates that window is told so and performs a full resync - discarding its clean rows, keeping its dirty ones.
A cursor older than the tombstone window, or newer than the server's Sequence (after a restore), answers `410` and the Device resyncs from 0.

## The Offline Mutation Queue is a set, not a log

What the server is owed is the *current state* of each changed thing, not the history of how it got there: ten offline edits to one Note owe one push.
Implementation follows: every mutation marks its row dirty inside the transaction that already writes it, and "the Queue" is `where('dirty')` - a way of reading the data, not a second store that could disagree with it.
This replaced an earlier plan for an ordered intent log, which was both more work and less robust (a crash can leave a log disagreeing with the rows).

## The loop

The client sync engine runs in a `SyncProvider` on the main thread, reading and writing the `LocalStore` and talking to a `Remote` ([ADR 0020](../adr/0020-the-local-store-seam.md)); it never touches Dexie (ceiling: move to a Worker if a large first pull janks the UI).
The `Remote` carries replication only (push, pull, put/get blob); sessions, Devices and Invites are a separate, optional `AccountService` that only the Self-hosted Server implements, so a self-hoster can point Sync at a Remote of their own.
Live Update is an SSE hint channel: the server writes the per-Account change *sequence* as the event `id` whenever a push is accepted, the device answers a hint with the same `pull(cursor)` it would poll with, and `Last-Event-ID` makes reconnection resume from the sequence for free (re-evaluated 2026-08-30, see below).
Catch-up is triggered by focus / `online` / visibility, and a slow poll is the fallback while the stream is down; a `Remote` without a hint stream is simply polled.

```mermaid
flowchart TD
    subgraph A["Device A"]
        A1["Edits note X at rev 4"]
    end
    subgraph S["Server"]
        S1["Accepts: note X becomes rev 5"]
        S2["Answers conflict for the stale row"]
        S3["Serves the change feed"]
        S4["Accepts the copy as a new thing: rev 1"]
    end
    subgraph B["Device B (was offline)"]
        B1["Edits note X at rev 4, offline"]
        B2["Pulls: server version becomes note X"]
        B3["Re-inserts own version as a new Note:
        the Conflicted Copy (tagged 'Conflicts', toast)"]
    end
    A1 -- "1: POST /api/changes: note X (rev 4)" --> S1
    B1 -- "2: POST /api/changes: note X (rev 4, stale)" --> S2
    S2 -- "3: 200, outcome conflict with the server row (rev 5)" --> B2
    B2 -- "4: GET changes (cursor)" --> S3
    S3 -- "5: note X @ rev 5" --> B2
    B2 --> B3
    B3 -- "6: POST Conflicted Copy (new id, no rev)" --> S4
```

Pull side: the change feed is a HAL collection; the device stores the opaque `_links.next` URL as its cursor and never constructs a query string.
Once caught up there is no `next`, so it keeps `_links.resume`, which the server points at the Account's current Sequence; `next` also carries where the pull began (`from`), so a full resync can page past Tombstones the server has already swept.
Pages carry a strong `ETag` over their body and the server answers `304`, so revalidation is cheap.
A page is not immutable, though: a re-edited row moves to a new Sequence.
The sync engine (`src/sync/engine.ts`) owns conflict handling, components never do; the Conflicted Copy is written through the Local Store like any Note, its Attachments cloned under new ids so every blob keeps one owner.
A Tag has no Conflicted Copy: the server's Tag wins, because two Tags of the same name would help nobody.
A stale purge answers `conflict` too, and the Device takes the newer Note back instead of deleting it.
The other way round - this Device edited a Note another Device purged - the edit is kept as a Conflicted Copy too, whether the push answers `gone` or the Tombstone arrives in a pull.

## Attachment transfer

- Bytes are immutable by id, so upload is "PUT if the server lacks this id" - idempotent, retryable, no conflict rule.
- **Previews sync eagerly** (tens of KB; the Feed is instantly correct on a new device); **full bytes on demand**, with a "keep everything on this device" preference.
- Attachment node views gain a third state, "known but not downloaded", rendering a placeholder instead of a broken element.
- Known ceilings, accepted: no resumable upload, no per-account quota.

## Account boundary interactions

- **Adopt on first sign-in**: a never-attached database bulk-marks every row dirty and pushes it (UUIDs cannot collide).
- **Erase on sign-out**: full local wipe (the server holds everything; prevents the next user of a shared laptop adopting someone else's Notes), blocked while anything is dirty and offering the zip backup first.
- Per-entity sync state (dirty / synced / conflicted) is exposed through the data hooks; the editor's "Saved" keeps meaning *saved locally*, shown separately, so the local-first guarantee is never conflated with sync.

## Re-evaluated 2026-08-30

The design was re-run from scratch against a wider candidate set - seven transports and eight server-side designs including CouchDB + PouchDB, RxDB, Yjs + Hocuspocus, PocketBase, Zero, ElectricSQL and PowerSync - under explicit gates and weighted criteria.
Working notes: [`docs/notes.md`](../notes.md); sourced findings: [`docs/research/sync/`](../research/sync/README.md); thesis text: `ni-dip-thesys/text/design/sync.tex`.
The model above won (148 of 165; runner-up RxDB 117) and survives removing the "fit with the existing frontend" criterion entirely.
Five amendments came out of it:

1. SSE is part of the design, not a follow-up (above).
2. A stale push is reported per row: `POST /api/changes` returns one outcome per row inside a `200`, `conflict` carrying the server row, `gone` for a tombstoned id.
   Per-resource `PUT` with `If-Match` is later work.
3. The change feed has a per-Account sequence distinct from per-row Revisions; the `_links.next` cursor and the SSE event id are that sequence.
4. The Background Sync API is a Chromium-only enhancement (no Safari support at all); the dirty set retried on `online` and on open is the guarantee everywhere. Web Push is rejected on the privacy line (a third-party relay).
5. Ids stay UUIDv4; UUIDv7 was considered for index locality and not adopted.

## Alternatives rejected (thesis material)

- **Field-level merge**: resolves the cheap fields and leaves the Body - the actual collision - on LWW anyway; per-field timestamps on every row is a poor trade for that.
- **Ready-made sync stacks** (2026-08-30): CouchDB wins only catch-up maturity and has no per-Device session revoke; Yjs wins only merge quality and makes the HTML Body a derived cache; PocketBase equals the build on operations and has no revision, feed or tombstones; the Postgres engines are two to four services and leave writes to us; Dexie Cloud and Couchbase fail the open-source gate. Details in [`docs/notes.md`](../notes.md).
- **CRDT (Yjs) for the Body**: the technically superior merge, rejected with reasons recorded. It would make the Yjs document the real Note and the HTML a derived cache (breaking the invariant relied on by card previews, search, backup and attachment references), wants a WebSocket rather than the brief's REST commitment, and would be the largest single item in M5, competing with the milestone's actual goal (sync an average person can set up). It remains open as a later Body-only upgrade inside the same Revision framework.

## Testing strategy

The client engine is tested in this repo against a fake server built from the vendored Zod contract, so conflict, resync and offline paths are deterministic.
The backend tests itself in its own repo; genuine two-device end-to-end is a manual and user-testing activity (a cross-repo Playwright pipeline would cost more than it catches).

## For the paper

- Frame the design as choosing a *failure mode*, not an algorithm: LWW-with-conflicted-copies trades automatic merging for zero silent data loss and a repair action a non-technical user can perform.
- The Revision-boundary table is the core analytical contribution: each row is an aggregate-design argument.
- The rejected-CRDT section writes itself into a related-work/alternatives chapter; the honest recording of why the superior merge lost is exactly what an architecture paper wants.
