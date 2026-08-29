# PLAN — `src/db` (data layer)

What's left in the persistence layer. See [root PLAN.md](../../PLAN.md) for milestone context.

## Data tests (M1)

- Add Vitest data tests using `fake-indexeddb/auto` (as `seeder.ts` already does): create/read/update/delete notes, tag attach/detach via `noteTags`, cascade delete clears relationships, and search-relevant fields.
- Factor the shared seeding logic out of `seeder.ts` / `browserSeeder.ts` into one helper so tests and both seeders use the same code path.

## Attachment storage (M3)

- ~~Decide **Blob vs base64** for image/audio/video/file payloads in IndexedDB.~~ Decided: native `Blob` (see [ADR 0007](../../docs/adr/0007-blob-over-base64-for-attachment-payloads.md)).
- ~~Add a `videos` table or fold video into `files` with a MIME-type discriminator.~~ Decided: one generic `attachments` table with a `kind` discriminator (`'image' | 'audio' | 'video' | 'file'`), replacing the separate per-type tables.
- ~~Reconcile the **embedded arrays on `Note`** (`images`/`audio`/`files`) with the normalized tables.~~ Decided: the embedded arrays are removed from `Note`; the `attachments` table (keyed by `noteId`) is the sole source of truth. `tags` on `Note` is unaffected by this decision.

## The Local Store seam (M5 slice 1)

This folder becomes `src/data/dexie/`, one implementation of the `LocalStore` interface beside an in-memory one ([ADR 0020](../../docs/adr/0020-the-local-store-seam.md), [plan](../../docs/superpowers/plans/2026-08-29-m5-slice1-local-store-seam.md)).
No schema bump: the `settings` table stays and is exposed as `meta`; the Preferences row leaves it for `localStorage` by a one-shot migration.

## Sync metadata (M5 slice 3)

Shape fixed by [ADR 0017](../../docs/adr/0017-note-level-last-writer-wins-with-conflicted-copies.md); see also [ADR 0001](../../docs/adr/0001-local-first-storage-with-dexie.md) and [ADR 0002](../../docs/adr/0002-separate-frontend-backend-repositories.md).

- **One `rev` and one dirty marker per synced row**, on `notes`, `tags` and `noteTags`. `rev` is the server's Revision the row last agreed with; absent means never pushed. The dirty marker is indexed, because "the Offline Mutation Queue" is a query over it - there is no queue table, and adding one would be a second source of truth that can disagree with the rows themselves.
- **A `tombstones` store** (`id`, entity kind, `deletedAt`), written only by a Purge. Trashing is a `state` update and syncs as an ordinary edit ([ADR 0009](../../docs/adr/0009-note-lifecycle-model.md)), so genuine deletions are rare and mostly machine-generated.
- **Attachments carry no `rev`.** Their metadata rides on the owning Note's Revision, and their bytes are write-once by id, so the only per-row sync state they need is "are the bytes here yet" (for the previews-eager / bytes-on-demand policy).
- **Sync cursor and account attachment live in `meta`** (the `settings` table under its ADR 0020 name), not in a new store: the opaque `_links.next` URL the server last handed out, `lastSyncedAt`, and the id of the Account this database is attached to (which is what makes erase-on-sign-out enforceable - see [ADR 0018](../../docs/adr/0018-the-server-serves-the-pwa.md)).
- **Prerequisite, not sync itself:** the Excalidraw save path must mint a *new* attachment id and repoint the Body, so that every blob in the database is immutable by id. The existing orphan sweep reclaims the old row.
- Bump the Dexie `version()` and write a migration whenever the schema changes; never mutate existing stores in place without a migration. Existing rows need no backfill here - an absent `rev` correctly means "never pushed", which is what a pre-sync database is.
