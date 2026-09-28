# 0017 - Note-level last-writer-wins, with the loser kept as a Conflicted Copy

- Status: Accepted, amended 2026-08-30
- Date: 2026-08-12

## Context

M5 syncs a local-first app against a self-hosted server.
Two devices can edit the same Note while one of them is offline, so the milestone cannot start until it is decided what happens then.
This is the one sync decision that could not be deferred to the backend repo ([ADR 0002](./0002-separate-frontend-backend-repositories.md)): it dictates this repo's Dexie schema, and it dictates whether a REST API is sufficient at all.

The Body is the thing being fought over.
It is one HTML string ([CONTEXT.md](../../CONTEXT.md)), authored in TipTap, and every richer element - attachments, checklists - lives inside it rather than beside it.
So a merge strategy that resolves `header`, `color` and `state` independently has not touched the conflict that actually happens.

## Decision

**The server holds a Revision per synced thing. A push carrying a stale Revision is rejected; the server's version becomes the Note, and the device's own version is kept beside it as an ordinary Note - a Conflicted Copy.**

Sync therefore never discards anything a user wrote.
Resolving a conflict is reading two Notes and deleting one, which is a thing a person does, not a thing the app does silently.

### The Revision boundary is the Note, its attachment metadata, and nothing else

An Attachment belongs to exactly one Note (`Attachment.noteId`, cascade delete) and has no independent life, so its metadata rides on the Note's Revision.

A Tag does have independent life - `CONTEXT.md` says so explicitly - so a Tag is its own synced thing with its own Revision.

A NoteTag link is its own synced row too, and that is the one piece of granularity bought deliberately.
The scenario is: typing into a note on the laptop while tapping "＋ Label → Work" on the same note on a phone.
If tag links rode on the Note's Revision, that innocent tap would produce a duplicate card.
Labelling must never conflict with writing.

### Attachment bytes are write-once

The only flow in the app that rewrote an existing Attachment's bytes was an Excalidraw save.
That is changed so a save mints a *new* Attachment and repoints the Body at it, leaving the old row to the orphan sweep that already exists.

Every blob in the system is then immutable by id, which means blob transfer is "upload if the server does not have this id" - an idempotent `PUT`, with no rev, no conflict rule, and no possibility of two devices disagreeing about what a given id contains.

### A deletion is a Tombstone, but deletions are rare

Because of [ADR 0009](./0009-note-lifecycle-model.md), trashing a Note is a `state` field update, not a delete, so the undo window syncs like any other edit.
A Tombstone is written only by a Purge.
Tombstones expire on the server after a bounded window (90 days); a device whose cursor predates that window is told so and re-pulls everything, discarding its clean rows and keeping its dirty ones.

## Consequences

- **A REST API remains sufficient.** Nothing here wants a persistent socket, which keeps the thesis brief's REST/HATEOAS commitment honest rather than decorative.
- **The Dexie schema gains a `rev` and a dirty marker per row, plus a `tombstones` store.** No merge metadata, no per-field timestamps, no operation log.
- **The Offline Mutation Queue is a set, not a log** - see the glossary. What the server is owed is the current state of each dirty row, so ten offline edits to one Note owe one push.
- **A Conflicted Copy needs surfacing or it is invisible.** It is an ordinary Note, so it lands quietly in the feed. It is therefore given a "Conflicts" Tag and a header naming its origin device and date, which makes the existing `/tag/$id` screen the review surface at no cost.
- **Concurrent edits to one Note lose no text but do produce a duplicate.** This is the honest cost, and it is the failure mode a user can understand and repair.

## Alternatives considered

**Field-level merge.**
Rejected. It resolves `header`, `color`, `pinnedAt` and `state` cleanly and leaves the Body - the thing people actually collide on - on last-writer-wins anyway.
Per-field timestamps on every row for that is a poor trade.

**CRDT (Yjs) for the Body.**
Rejected, and it is the technically superior merge, so the rejection deserves recording.
It makes a Yjs document the real Note and the TipTap HTML a *derived cache* - and that HTML is read by card previews, Fuse.js search, the zip backup, and every `data-attachment-id` reference in the app.
Its natural transport is a WebSocket, not the REST API the brief commits to.
It would be the largest single thing in M5 and it competes with the milestone's actual goal, which is sync that an average person can set up and rely on.
It stays available as a later, Body-only upgrade: the Revision and the Conflicted Copy would remain correct for everything around it.

## Amended 2026-08-30

Re-evaluated from scratch against a wider candidate set (CouchDB + PouchDB, RxDB, Yjs + Hocuspocus, PocketBase, Zero, ElectricSQL, PowerSync, and seven transports) under explicit gates and weighted criteria; notes in [`docs/notes.md`](../notes.md), sources in [`docs/research/sync/`](../research/sync/README.md), thesis text in `ni-dip-thesys/text/design/sync.tex`.
The decision stands and is amended as follows:

- **SSE is part of the design.** "A REST API remains sufficient" still holds for data; Live Update is a `text/event-stream` hint whose event `id` is the change sequence, and polling is the Catch-up trigger and the fallback. In the frontend this is one optional method on the `Remote` seam.
- **A stale push is `412 Precondition Failed` against `If-Match`**, with the Revision as the row's `ETag`, rather than a 409.
- **The change feed has a per-Account sequence** distinct from per-row Revisions; the opaque cursor and the SSE event id are that sequence.
- **Background Sync is an enhancement, never the guarantee**; it has no Safari support. Web Push is rejected as a third-party relay.
- **Ids stay UUIDv4**; UUIDv7 considered and not adopted.
