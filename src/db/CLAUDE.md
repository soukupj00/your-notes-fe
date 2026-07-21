# CLAUDE.md — `src/db` (data layer)

How the local persistence layer works. See [`PLAN.md`](./PLAN.md) for upcoming work and [root CONTEXT.md](../../CONTEXT.md) for term definitions. Storage approach is fixed by [ADR 0001](../../docs/adr/0001-local-first-storage-with-dexie.md).

## Files

- `db.ts` — the Dexie database (`NotesDB`) and the exported singleton `db`.
- `models.ts` (in `src/`, not here) — the TypeScript interfaces for every entity. The Dexie tables are typed against these.
- `dummyNotes.ts` — static sample notes used for seeding.
- `seeder.ts` — Node/`ts-node` seeder (`pnpm seed`); imports `fake-indexeddb/auto` so it runs outside a browser.
- `browserSeeder.ts` — `seedBrowserData()` called from the running app (a "Seed Notes" button in `App.tsx`) to populate the real browser IndexedDB.

## Schema (`NotesDB`, version 2)

| Table         | Primary key            | Indexes                          | Model        |
|---------------|------------------------|-----------------------------------|--------------|
| `notes`       | `id`                   | `header`, `createdAt`, `updatedAt` | `Note`      |
| `attachments` | `id`                   | `noteId`, `kind`                   | `Attachment` |
| `tags`        | `id`                   | `name`                            | `Tag`        |
| `noteTags`    | `[noteId+tagId]` (composite) | `noteId`, `tagId`           | `NoteTag`    |

- **Attachments** are a single generic table, 1:N with a Note via `noteId`. The `kind` discriminator (`'image' | 'audio' | 'video' | 'file'`) distinguishes attachment types instead of separate per-type tables; bytes are stored as a native `Blob` (see [ADR 0007](../../docs/adr/0007-blob-over-base64-for-attachment-payloads.md)). The Note body references an attachment by id (`<img data-attachment-id>`); `Note` no longer carries embedded media arrays.
- **Tags** are many-to-many with Notes through the `noteTags` join table, keyed by the composite `[noteId+tagId]`.

## Conventions

- **IDs**: `uuid` v4 strings for every entity.
- **Timestamps**: ISO strings via `new Date().toISOString()`, on both `createdAt` and `updatedAt`.
- **Mutations** that touch relationships use `db.transaction('rw', ...)` (see the seeders and `useNoteActions.deleteNote`, which also clears `noteTags`).
- Reads in components go through the hooks in [`src/hooks/data`](../hooks/data/CLAUDE.md), not direct `db` access.

## Gotchas

- Both seeders duplicate the same logic; keep them in sync or factor the shared bit out.
- The `seeder.ts` path uses `fake-indexeddb`, so `pnpm seed` populates an in-memory DB (useful for tests/CI), **not** your browser. Use the in-app "Seed Notes" button (`browserSeeder.ts`) to populate real browser data.
