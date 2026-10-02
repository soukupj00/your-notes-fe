# CLAUDE.md - `src/data` (the Local Store)

The seam every read and write of persisted data goes through ([ADR 0020](../../docs/adr/0020-the-local-store-seam.md)); terms in [CONTEXT.md](../../CONTEXT.md) (Local Store, Remote, Preference).

## Files

- `LocalStore.ts` - the interface. Domain-shaped, atomic per method, live reads return `Live<T>`.
- `live.ts`, `useLive.ts` - the observable contract and its one React adapter.
- `LocalStoreProvider.tsx` - context; `useLocalStore()` throws outside it.
- `localStore.contract.ts` - the behaviour every implementation must have. It is the spec; both implementations run it. It also runs `localStore.sync.contract.ts` (what a write owes the server) and `localStore.pull.contract.ts` (writing what the server answers).
- `syncRows.ts` - pure helpers both implementations share for sync state: stripping it on read, the wire shape of a Note, pairing push outcomes with the batch.
- `dexie/` - the default implementation (IndexedDB). `db.ts` is private to this folder, enforced by Biome's `noRestrictedImports`. Its `sync` half is `dexie/sync.ts`; `dexie/live.ts` is the `liveQuery` adapter both files share.
- `memory/` - the second implementation: nothing persists, atomic by being single-threaded. It is the "cache only" configuration and what proves the interface is not Dexie in disguise.
- `Remote.ts` - the sync seam: `Remote` (replication) and `AccountService` (sessions, Devices, Pairing, Share Links), typed from the vendored contract (`src/contract/`, `pnpm contract:pull`).
- `http/` - the Self-hosted Server's implementations of both seams. `hal.ts` is the one door: it follows the HAL root's links, parses every body with the contract (a drift throws at the boundary), and turns `application/problem+json` into `ProblemError`. Tests run against `src/test/fakeServer.ts`, whose answers are parsed by the same contract.
  `publicShare.ts` is the one read outside `AccountService`: a Share Link's page is read with no Account (`fetchSharedNote`, 404 answers `'gone'`), and its blob URLs come from the page's own `_links.blobs` template (`sharedBlobUrl`).

## Rules

- Nothing outside `dexie/` imports `dexie`; nothing outside `src/data` imports from `dexie/` except `main.tsx` and `src/test/store.tsx` (the two composition points).
- The store stamps nothing a caller could stamp: ids and a row's birth timestamps are the caller's (`lib/rows.ts`). The two exceptions are its own bookkeeping: `tags.merge` stamps the links it relabels, and a Tombstone's `deletedAt` is stamped in `syncRows.ts`.
- Search, sort and held rank live in `src/hooks/data`, in front of the seam.
- `meta` is bookkeeping about rows (Prop baselines; the sync cursor and Account under `SYNC_META_KEYS`). Preferences are not here - they are in `localStorage` (`PreferencesProvider`).
- The sync engine (`src/sync/`) is the only caller of `sync.*`. `applyPage` writes what the server answers: in `keep-local` mode (a pull) an owed row or a pending purge waits for its push, in `server-wins` mode (resolving an outcome) the server's row overwrites it. A server Tombstone removes a row (a Note with its links and Attachments, a Tag with its links) without writing a local one, and drops a pending local Tombstone for the same id.
  A written Note's `attachments` become its rows: new ones without bytes, known ones keeping theirs (a thumbnail only while `thumbnailId` is unchanged), unlisted ones removed.
  `syncRows.ts` holds that rule once for both stores.
- An Attachment's transfer state is store-private too (M5 slice 5): `onServer`, the blob ids the server is known to hold (its own id, its `thumbnailId`), and `tooLarge`.
  No read returns them, so a clone never inherits "already uploaded", and none of `sync.onServer`, `tooLarge` or `received` owes the Note, because none changes what it says.
  `attachments.update` cannot take `blob`, and takes a `thumbnail` only with a new `thumbnailId` (`AttachmentChanges`), so an id never gets new bytes; downloaded bytes arrive through `sync.received`.
  `blob` is optional: a row pulled from another Device has metadata and, soon after, its thumbnail, but its full bytes only once someone asks.
- Sync state is store-private. `rev` and the dirty marker never leave the store on a read, and every write keeps the stored `rev`, so no caller can carry a stale Revision into a write. Writes owe the row; an Attachment write owes its Note, because an Attachment's metadata rides on the Note's Revision; removing a row the server has seen leaves a Tombstone with its `rev` (one never pushed leaves nothing), and putting the row back takes it back.
- The Dexie table under `meta` is still called `settings`. No schema bump was spent on a rename.

## Bringing your own Local Store

1. Implement `LocalStore` in a folder beside `dexie/` and `memory/`.
2. Add a test file that calls `describeLocalStoreContract(() => makeYourStore())` and make it pass.
3. Change the one line in `src/main.tsx` that calls `createDexieLocalStore()`.

There is no runtime switch and there will not be one: a user-facing toggle to a non-persisting store is a data-loss button.

## Dexie implementation

There is no seeder.
`dummyNotes.ts`, `seed.ts`, `seeder.ts` and `browserSeeder.ts` were deleted once nothing called them: the in-app "Seed Notes" button had already gone, and `pnpm seed` could not run at all because `ts-node` is not a dependency.
Sample data now comes from the Tour's Props (`lib/tour/props.ts`), which a fresh install creates and purges for itself.

### Schema (`NotesDB`, version 5)

| Table         | Primary key            | Indexes                          | Model        |
|---------------|------------------------|-----------------------------------|--------------|
| `notes`       | `id`                   | `header`, `createdAt`, `updatedAt`, `state`, `pinnedAt`, `trashedAt`, `dirty` | `Stored<Note>` |
| `attachments` | `id`                   | `noteId`, `kind`                   | `Attachment` |
| `tags`        | `id`                   | `name`, `dirty`                   | `Stored<Tag>` |
| `noteTags`    | `[noteId+tagId]` (composite) | `noteId`, `tagId`, `dirty`  | `Stored<NoteTag>` |
| `settings`    | `key`                  | (none)                            | `Setting`    |
| `tombstones`  | `id`                   | (none)                            | `Tombstone`  |

- **Attachments** are a single generic table, 1:N with a Note via `noteId`. The `kind` discriminator (`'image' | 'audio' | 'video' | 'file'`) distinguishes attachment types instead of separate per-type tables; bytes are stored as a native `Blob` (see [ADR 0007](../../docs/adr/0007-blob-over-base64-for-attachment-payloads.md)). The Note body references an attachment by id (`<img data-attachment-id>`); `Note` no longer carries embedded media arrays.
- **Note lifecycle** (v3, [ADR 0009](../../docs/adr/0009-note-lifecycle-model.md)): `state` (`'active' | 'archived' | 'trashed'`) is the mutually-exclusive stage; `pinnedAt`, `color` (a palette token from `lib/note-colors.ts`, never a raw colour), and `trashedAt` are orthogonal optional fields. v3 carries the one `.upgrade()` in the schema's history: it backfills `state: 'active'` and deletes the retired `checklist` array. The upgrade is **not** optional - `state` is indexed, and IndexedDB skips rows whose indexed property is `undefined`, so un-stamped rows would be invisible to `where('state')`.
- **Tags** are many-to-many with Notes through the `noteTags` join table, keyed by the composite `[noteId+tagId]`.
- **Settings** (v4) is a generic key-value store for app state that is not a domain entity - it is exposed as the Local Store's `meta` (`src/data/LocalStore.ts`; [ADR 0020](../../docs/adr/0020-the-local-store-seam.md)). Preferences moved off it into `localStorage` (owned by [`PreferencesProvider`](../context/CLAUDE.md)); today it holds the Tour's Prop baselines under `tourProps` (`src/lib/tour/props.ts`). `src/data/dexie/legacyPreferences.ts` runs the one-shot split for a database that still carries the old `preferences` row.
- **Sync metadata** (v5, M5 slice 3): `Stored<T>` is the row plus `rev?` (the Revision it last agreed with; absent = never pushed) and `dirty?: 1` (owed to the server). `dirty` is `1` or absent because IndexedDB does not index `undefined`, so `where('dirty').equals(1)` reads exactly the owed rows. `tombstones` is keyed by the removed row's id, a NoteTag's being `noteTagId(noteId, tagId)`. No upgrade: a pre-sync row is correctly unpushed and not owed; adopt-on-first-sign-in (slice 4) owes them. `sync.migration.test.ts` opens a literal v4 database as v5.
- **Attachment transfer state** (M5 slice 5) needed no bump: `attachments` indexes only `id, noteId, kind`, and `thumbnailId`, `onServer` and `tooLarge` are plain fields.
  A row written before them is correctly "nothing known to be on the server".
