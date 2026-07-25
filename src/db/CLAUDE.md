# CLAUDE.md — `src/db` (data layer)

How the local persistence layer works. See [`PLAN.md`](./PLAN.md) for upcoming work and [root CONTEXT.md](../../CONTEXT.md) for term definitions. Storage approach is fixed by [ADR 0001](../../docs/adr/0001-local-first-storage-with-dexie.md).

## Files

- `db.ts` — the Dexie database (`NotesDB`) and the exported singleton `db`.
- `models.ts` (in `src/`, not here) — the TypeScript interfaces for every entity. The Dexie tables are typed against these.
- `dummyNotes.ts` — static sample notes used for seeding; covers every lifecycle state (active/pinned/coloured, archived, recently trashed, and one back-dated past the purge window).
- `seed.ts` — `seedDummyData()`, the single shared wipe-and-repopulate routine.
- `seeder.ts` — Node/`ts-node` entry point (`pnpm seed`); imports `fake-indexeddb/auto` so it runs outside a browser.
- `browserSeeder.ts` — `seedBrowserData()`, the in-app entry point for populating the real browser IndexedDB. Currently unwired (there is no "Seed Notes" button any more).

## Schema (`NotesDB`, version 4)

| Table         | Primary key            | Indexes                          | Model        |
|---------------|------------------------|-----------------------------------|--------------|
| `notes`       | `id`                   | `header`, `createdAt`, `updatedAt`, `state`, `pinnedAt`, `trashedAt` | `Note` |
| `attachments` | `id`                   | `noteId`, `kind`                   | `Attachment` |
| `tags`        | `id`                   | `name`                            | `Tag`        |
| `noteTags`    | `[noteId+tagId]` (composite) | `noteId`, `tagId`           | `NoteTag`    |
| `settings`    | `key`                  | (none)                            | `Setting`    |

- **Attachments** are a single generic table, 1:N with a Note via `noteId`. The `kind` discriminator (`'image' | 'audio' | 'video' | 'file'`) distinguishes attachment types instead of separate per-type tables; bytes are stored as a native `Blob` (see [ADR 0007](../../docs/adr/0007-blob-over-base64-for-attachment-payloads.md)). The Note body references an attachment by id (`<img data-attachment-id>`); `Note` no longer carries embedded media arrays.
- **Note lifecycle** (v3, [ADR 0009](../../docs/adr/0009-note-lifecycle-model.md)): `state` (`'active' | 'archived' | 'trashed'`) is the mutually-exclusive stage; `pinnedAt`, `color` (a palette token from `lib/note-colors.ts`, never a raw colour), and `trashedAt` are orthogonal optional fields. v3 carries the one `.upgrade()` in the schema's history: it backfills `state: 'active'` and deletes the retired `checklist` array. The upgrade is **not** optional — `state` is indexed, and IndexedDB skips rows whose indexed property is `undefined`, so un-stamped rows would be invisible to `where('state')`.
- **Tags** are many-to-many with Notes through the `noteTags` join table, keyed by the composite `[noteId+tagId]`.
- **Settings** (v4) is a generic key-value store for app state that is not a domain entity.
Today it holds exactly one row, `preferences`, owned by [`PreferencesProvider`](../context/CLAUDE.md).
The blob carries its own Zod schema `version`, so adding or changing a preference never costs a Dexie version bump.

## Conventions

- **IDs**: `uuid` v4 strings for every entity.
- **Timestamps**: ISO strings via `new Date().toISOString()`, on both `createdAt` and `updatedAt`.
- **Mutations** that touch relationships use `db.transaction('rw', ...)` (see the seeders and `useNoteActions.deleteNote`, which also clears `noteTags`).
- Reads in components go through the hooks in [`src/hooks/data`](../hooks/data/CLAUDE.md), not direct `db` access.

## Gotchas

- The `seeder.ts` path uses `fake-indexeddb`, so `pnpm seed` populates an in-memory DB (useful for tests/CI), **not** your browser. Use the in-app "Seed Notes" button (`browserSeeder.ts`) to populate real browser data.
