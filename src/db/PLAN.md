# PLAN — `src/db` (data layer)

What's left in the persistence layer. See [root PLAN.md](../../PLAN.md) for milestone context.

## Data tests (M1)

- Add Vitest data tests using `fake-indexeddb/auto` (as `seeder.ts` already does): create/read/update/delete notes, tag attach/detach via `noteTags`, cascade delete clears relationships, and search-relevant fields.
- Factor the shared seeding logic out of `seeder.ts` / `browserSeeder.ts` into one helper so tests and both seeders use the same code path.

## Attachment storage (M3)

- ~~Decide **Blob vs base64** for image/audio/video/file payloads in IndexedDB.~~ Decided: native `Blob` (see [ADR 0007](../../docs/adr/0007-blob-over-base64-for-attachment-payloads.md)).
- ~~Add a `videos` table or fold video into `files` with a MIME-type discriminator.~~ Decided: one generic `attachments` table with a `kind` discriminator (`'image' | 'audio' | 'video' | 'file'`), replacing the separate per-type tables.
- ~~Reconcile the **embedded arrays on `Note`** (`images`/`audio`/`files`) with the normalized tables.~~ Decided: the embedded arrays are removed from `Note`; the `attachments` table (keyed by `noteId`) is the sole source of truth. `tags` on `Note` is unaffected by this decision.

## Sync metadata (M5)

- Add fields/tables to support sync against the self-hosted server ([ADR 0001](../../docs/adr/0001-local-first-storage-with-dexie.md), [ADR 0002](../../docs/adr/0002-separate-frontend-backend-repositories.md)):
  - a dirty/pending flag or revision per entity,
  - tombstones for deletes (so deletions propagate),
  - server revision / `lastSyncedAt` to detect conflicts.
- Bump the Dexie `version()` and write a migration whenever the schema changes; never mutate existing stores in place without a migration.
