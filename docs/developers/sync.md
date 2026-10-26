# Sync

Sync reconciles a Device's Local Store with a Remote, so a person's other Devices see the same Notes.
The app never reads a Remote to show something; it reads the Local Store, and Sync keeps that up to date.
This page is the developer's view; [Sync in the reference](../architecture/04-sync.md) has the whole design and the alternatives it beat.

## The model

**Note-level last-writer-wins, with the loser kept** ([ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md)).

- The server holds a **Revision** per synced row: a count of the changes it has accepted.
  A Device only ever reports the Revision it was given; it never invents one.
- A push that carries a stale Revision loses.
  The server's version becomes the Note, and the Device keeps its own version beside it as a new, ordinary Note: a **Conflicted Copy**.
  It is titled `Groceries (conflict from Pixel 8, 2026-09-28)` and labelled "Conflicts", so the existing label view is where a person reviews them.
- So Sync never discards what someone wrote; resolving a conflict is reading two Notes and deleting one.

Three things have their own Revision: a Note (with its Attachments' metadata), a Tag, and a NoteTag link.
The link has its own so that labelling a Note on the phone never conflicts with typing into it on the laptop.
Attachment bytes have none: they are write-once by id, so moving them is an idempotent `PUT`.

## The Offline Mutation Queue is a query

What the server is owed is the current state of each changed row, not the history of how it got there.
So every write marks its row dirty inside the same store transaction, and the queue is simply the set of dirty rows (`store.sync.dirty()`).
Ten offline edits to one Note owe one push, and there is no second record that a crash could leave disagreeing with the rows.

Deleting is the one exception to "a write is a row".
Trashing a Note is an ordinary field change and syncs like any edit.
Only a Purge removes a row, and it leaves a **Tombstone** carrying the Revision the Device last agreed with, so a stale purge cannot discard a newer edit made elsewhere.

## One run

`src/sync/engine.ts` runs one sync at a time:

1. **Push** what is owed, in batches, Notes before Tags before links before Tombstones.
   The server answers one outcome per row: `accepted`, `conflict` with its own row, or `gone` for a tombstoned id.
   A `conflict` on a Note makes the Conflicted Copy; on a Tag, the server's Tag simply wins.
2. **Pull** what was missed, page by page.
   The cursor is the opaque `next` link the server handed out; the Device stores it and never builds a URL.
   A cursor too old for the server answers `410`, and the Device resyncs from the start, dropping its clean rows and keeping the ones it still owes.
3. **Move Attachment bytes.**
   Everything goes up, Previews first.
   Coming down, Previews arrive at once, since the Feed needs them; full bytes arrive when someone opens them, unless "Keep every attachment" is on.

`src/sync/loop.ts` decides when to run: at start, a moment after a local edit, when the browser comes back online or the tab becomes visible, when the server's hint stream says another Device pushed, and on a slow poll.
A run that leaves work owed backs off, doubling, so a failing server never makes it spin.
`SyncProvider` only starts and stops the loop; components never touch Sync.

## The Remote seam

The engine talks to two interfaces in `src/data/Remote.ts`, not to HTTP.

- **`Remote`** is replication only: `identity`, `push`, `pull`, `putBlob`, `getBlob`, and an optional `hints` stream for Live Updates.
  A Remote without `hints` is simply polled.
- **`AccountService`** is everything about people: Sessions, Devices, Pairing Links, Invites, Share Links.
  Only the Self-hosted Server implements it, and the Account screens render only when one is configured.

Both are implemented for the Self-hosted Server in `src/data/http/`.
Every response is parsed with the Zod schemas of the wire contract, `src/contract/index.ts`, so a server change that breaks the app fails at the boundary, loudly.
The contract belongs to the server's repository and is copied here by `pnpm contract:pull`; never edit it here.

To sync with something of your own, implement `Remote` against it and pass it to `App` in `src/main.tsx`, in place of `createHalRemote`.
Today the loop starts once an Account is signed in, and the Account comes from the `AccountService`, so a Remote without accounts also needs a small change in `SyncProvider` to give it an Account id.

## Accounts and the Local Store

- **Adopt on first sign-in.** A database that was never attached to an Account marks every row owed and pushes it all; ids are random UUIDs, so they cannot collide.
- **Erase on sign-out.** Signing out wipes the Local Store, so the next person on a shared laptop never adopts someone else's Notes.
  It is refused while anything is still owed, and offers a Backup instead.
- The editor's "Saved" means saved locally; sync state is shown separately, as a count of changes waiting, in Settings.

## Testing

The engine and the loop are tested in `src/sync/` against a fake server built from the same contract, so conflicts, resyncs and an offline queue are deterministic.
Two real Devices against a real server stay a manual check.
