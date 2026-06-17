# PLAN — `src/db` (data layer)

What's left in the persistence layer. See [root PLAN.md](../../PLAN.md) for milestone context.

## Data tests (M1)

- Add Vitest data tests using `fake-indexeddb/auto` (as `seeder.ts` already does): create/read/update/delete notes, tag attach/detach via `noteTags`, cascade delete clears relationships, and search-relevant fields.
- Factor the shared seeding logic out of `seeder.ts` / `browserSeeder.ts` into one helper so tests and both seeders use the same code path.

## Attachment storage (M3)

- Decide **Blob vs base64** for image/audio/video/file payloads in IndexedDB (Blobs are more memory-efficient and IndexedDB-native; base64 is simpler to serialize for sync). Document the choice as an ADR if non-obvious.
- Add a `videos` table (the `NoteFile`/media model exists conceptually; the editor will gain a Video extension in M3) or fold video into `files` with a MIME-type discriminator — decide and record.
- Reconcile the **embedded arrays on `Note`** (`images`/`audio`/`files`/`tags`) with the normalized tables. Pick one as source of truth (recommended: normalized tables; treat embedded arrays as hydrated read views) and document it.

## Sync metadata (M5)

- Add fields/tables to support sync against the self-hosted server ([ADR 0001](../../docs/adr/0001-local-first-storage-with-dexie.md), [ADR 0002](../../docs/adr/0002-separate-frontend-backend-repositories.md)):
  - a dirty/pending flag or revision per entity,
  - tombstones for deletes (so deletions propagate),
  - server revision / `lastSyncedAt` to detect conflicts.
- Bump the Dexie `version()` and write a migration whenever the schema changes; never mutate existing stores in place without a migration.
