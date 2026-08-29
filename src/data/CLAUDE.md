# CLAUDE.md - `src/data` (the Local Store)

The seam every read and write of persisted data goes through ([ADR 0020](../../docs/adr/0020-the-local-store-seam.md)); terms in [CONTEXT.md](../../CONTEXT.md) (Local Store, Remote, Preference).

## Files

- `LocalStore.ts` - the interface. Domain-shaped, atomic per method, live reads return `Live<T>`.
- `live.ts`, `useLive.ts` - the observable contract and its one React adapter.
- `LocalStoreProvider.tsx` - context; `useLocalStore()` throws outside it.
- `localStore.contract.ts` - the behaviour every implementation must have. It is the spec; both implementations run it.
- `dexie/` - the default implementation (IndexedDB). `db.ts` is private to this folder, enforced by Biome's `noRestrictedImports`.
- `memory/` - the second implementation: nothing persists, atomic by being single-threaded. It is the "cache only" configuration and what proves the interface is not Dexie in disguise.
- `Remote.ts` - the sync seam, types only until M5 slice 3.

## Rules

- Nothing outside `dexie/` imports `dexie`; nothing outside `src/data` imports from `dexie/` except `main.tsx` and `src/test/store.tsx` (the two composition points).
- The store stamps nothing: ids and timestamps are the caller's (`lib/new-note.ts`).
- Search, sort and held rank live in `src/hooks/data`, in front of the seam.
- `meta` is bookkeeping about rows (Prop baselines; the sync cursor and Account in M5). Preferences are not here - they are in `localStorage` (`PreferencesProvider`).
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

### Schema (`NotesDB`, version 4)

| Table         | Primary key            | Indexes                          | Model        |
|---------------|------------------------|-----------------------------------|--------------|
| `notes`       | `id`                   | `header`, `createdAt`, `updatedAt`, `state`, `pinnedAt`, `trashedAt` | `Note` |
| `attachments` | `id`                   | `noteId`, `kind`                   | `Attachment` |
| `tags`        | `id`                   | `name`                            | `Tag`        |
| `noteTags`    | `[noteId+tagId]` (composite) | `noteId`, `tagId`           | `NoteTag`    |
| `settings`    | `key`                  | (none)                            | `Setting`    |

- **Attachments** are a single generic table, 1:N with a Note via `noteId`. The `kind` discriminator (`'image' | 'audio' | 'video' | 'file'`) distinguishes attachment types instead of separate per-type tables; bytes are stored as a native `Blob` (see [ADR 0007](../../docs/adr/0007-blob-over-base64-for-attachment-payloads.md)). The Note body references an attachment by id (`<img data-attachment-id>`); `Note` no longer carries embedded media arrays.
- **Note lifecycle** (v3, [ADR 0009](../../docs/adr/0009-note-lifecycle-model.md)): `state` (`'active' | 'archived' | 'trashed'`) is the mutually-exclusive stage; `pinnedAt`, `color` (a palette token from `lib/note-colors.ts`, never a raw colour), and `trashedAt` are orthogonal optional fields. v3 carries the one `.upgrade()` in the schema's history: it backfills `state: 'active'` and deletes the retired `checklist` array. The upgrade is **not** optional - `state` is indexed, and IndexedDB skips rows whose indexed property is `undefined`, so un-stamped rows would be invisible to `where('state')`.
- **Tags** are many-to-many with Notes through the `noteTags` join table, keyed by the composite `[noteId+tagId]`.
- **Settings** (v4) is a generic key-value store for app state that is not a domain entity - it is exposed as the Local Store's `meta` (`src/data/LocalStore.ts`; [ADR 0020](../../docs/adr/0020-the-local-store-seam.md)). Preferences moved off it into `localStorage` (owned by [`PreferencesProvider`](../context/CLAUDE.md)); today it holds the Tour's Prop baselines under `tourProps` (`src/lib/tour/props.ts`). `src/data/dexie/legacyPreferences.ts` runs the one-shot split for a database that still carries the old `preferences` row.
