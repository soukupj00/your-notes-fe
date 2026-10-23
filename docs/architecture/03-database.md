# Database and schema

All persistence is IndexedDB, accessed through **Dexie** (`src/data/dexie/db.ts`); domain models live in `src/models.ts`.
The app reaches it only through the `LocalStore` interface ([ADR 0020](../adr/0020-the-local-store-seam.md)): Dexie is the default implementation, an in-memory one ships beside it, and one contract test suite runs against both.
IndexedDB was chosen over alternatives for real Blob storage, transactions, indexes, and the storage quota a notes app with media needs ([ADR 0001](../adr/0001-local-first-storage-with-dexie.md)); attachment bytes are stored as native `Blob`s, not base64 ([ADR 0007](../adr/0007-blob-over-base64-for-attachment-payloads.md)).

The schema itself is unchanged by ADR 0020 - the app no longer touches it directly.
Two `LocalStore` implementations exist: Dexie (below) and an in-memory one (`src/data/memory/`).
Preferences left the `settings` table for `localStorage`; what remains there is bookkeeping under `meta` (the sync cursor and attached Account).

## Entity model

```mermaid
erDiagram
    NOTE ||--o{ NOTE_TAG : "labelled by"
    TAG ||--o{ NOTE_TAG : "labels"
    NOTE ||--o{ ATTACHMENT : "owns (cascade delete)"
    NOTE {
        string id "uuid"
        string header "optional"
        string description "optional plaintext subtitle (dormant)"
        string body "rich-text HTML; references attachments by id"
        string state "active | archived | trashed (indexed)"
        string pinnedAt "ISO; presence = pinned, value orders pins"
        string color "palette token, never a raw value"
        string trashedAt "ISO; drives the 30-day purge sweep"
        string createdAt "ISO"
        string updatedAt "ISO"
    }
    TAG {
        string id "uuid"
        string name
        string color "palette token"
        string position "label order key, base-62; absent = A to Z (ADR 0027)"
        string createdAt "ISO"
        string updatedAt "ISO"
    }
    NOTE_TAG {
        string noteId "PK part, FK"
        string tagId "PK part, FK"
        string createdAt "ISO"
        string updatedAt "ISO"
    }
    ATTACHMENT {
        string id "uuid"
        string noteId "FK, exactly one owner"
        string kind "image | audio | video | file | excalidraw"
        string mime
        Blob blob "authoritative bytes, write-once by id"
        Blob thumbnail "image Preview (WebP <=512px)"
        string thumbnailId "the Preview's own blob id on the server"
        string preview "excalidraw SVG snapshot"
        string name "original filename"
        number size
        number width_height_duration "kind-dependent metadata"
        string createdAt "ISO"
        string updatedAt "ISO"
    }
    SETTING {
        string key "PK"
        any value "e.g. the versioned preferences blob"
    }
```

Conventions: every id is a UUID minted by `mintId` (`src/lib/rows.ts`); every timestamp is an ISO string, except a Reminder's `remindAt`, a local wall-clock string ([ADR 0021](../adr/0021-reminders-are-handed-off-to-the-calendar.md)).
Synced rows also carry store-private sync state (below), and a `tombstones` store records Purges the server is owed.

Design points worth defending in the paper:

- **The Body is the aggregate's spine.** Attachments and Checklists live *inside* the HTML Body as references (`data-attachment-id`), not beside it as sibling collections. The `attachments` table owns the bytes; the Body decides which are shown and where. This single fact later dictates the sync conflict model (see [04-sync.md](./04-sync.md)).
- **One generic `attachments` table** with a `kind` discriminator replaced planned per-type tables (v2). Every media slice since has reused the same storage, actions and GC.
- **`NoteTag` is a real join table** (composite primary key `[noteId+tagId]`), because a Tag has independent life. The link is its own synced row precisely so labelling never conflicts with writing.
- **`settings` is a key-value store**, exposed as the Local Store's `meta`; it holds sync bookkeeping (the cursor and attached Account), and values still version themselves where needed.
- **Orphans are swept, not chased.** Removing an attachment reference does not delete bytes immediately (in-editor undo may bring it back); a reconciliation sweep at editor close and app start reclaims unreferenced rows. Purge (trash grace elapsed) uses the same sweep machinery.

One denormalization exists: `Note.tags?: Tag[]` is an optional preloaded override consumed by `NoteCard` (which falls back to the live `useTagsForNote` query when absent). The join table remains the source of truth.

## Schema versions

Dexie strings declare *indexes*, not columns - non-indexed fields are free, which shapes when a version bump is needed at all.

| Version | Change | Migration |
|---|---|---|
| v1 | `notes`, per-type `images`/`audios`/`files`, `tags`, `noteTags` | - |
| v2 | Fold the never-populated per-type media tables into one `attachments` (`id, noteId, kind`) | None needed (stores were never written) |
| v3 | Note lifecycle ([ADR 0009](../adr/0009-note-lifecycle-model.md)): index `state`, `pinnedAt`, `trashedAt`; retire the dead `checklist` field | **`.upgrade()` required**: `state` is indexed and IndexedDB omits rows whose indexed property is `undefined` - without stamping `state: 'active'` on existing rows, every pre-v3 note would silently vanish from `where('state')` queries |
| v4 | `settings` key-value store | None |
| v5 | Sync metadata: an indexed dirty marker on `notes`, `tags`, `noteTags`; the `tombstones` store | None: an absent `rev` correctly means "never pushed" |

The v3 lesson generalizes and is the repo's canonical migration rule: adding an *optional, non-indexed* field is free; adding an *indexed* field requires backfilling every existing row or those rows become invisible to queries on it.

## Sync metadata (v5)

Shape fixed by [ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md); the rules are in [`src/data/CLAUDE.md`](https://github.com/soukupj00/your-notes-fe/blob/main/src/data/CLAUDE.md).

- **`rev` + an indexed dirty marker** on `notes`, `tags`, `noteTags`. `rev` is the server Revision the row last agreed with; absent means never pushed - which is exactly what a pre-sync database is, so no backfill was needed.
  Both are store-private: no read returns them, so no caller can carry a stale Revision into a write.
- **The Offline Mutation Queue is a query, not a table**: the rows with the dirty marker. There is deliberately no queue store - it would be a second source of truth a crash could leave disagreeing with the rows themselves.
- **A `tombstones` store**, written only by a Purge; trashing is a `state` update and syncs as an ordinary edit.
- **Attachments carry no `rev`.** Metadata rides on the owning Note's Revision; bytes are write-once by id, so their only sync state is which blobs the server holds and whether the bytes are present locally (previews sync eagerly, full bytes on demand).
  The one rewriter, the Excalidraw save, mints a new attachment id and repoints the Body.
- **Cursor and account identity live in `meta`**: the opaque cursor URL, the last sync time, and the attached Account id (what makes erase-on-sign-out enforceable).

## Testing the layer

Data-layer tests run in Vitest against `fake-indexeddb`, including a dedicated migration test (`lifecycle.migration.test.ts`) and a Blob round-trip test that must run in the `node` environment (jsdom reads a stored Blob back as a plain object).
The `NotesDB` constructor takes a database name only so migration tests can spin up throwaway instances; the app uses one singleton.

## For the paper

- The schema is small by design: six stores, one of them a join table and one a KV store. The interesting content is the *rules around it* - Body-as-spine, write-once blobs, sweep-based GC, queue-as-query - each of which removes a class of consistency bug rather than handling it.
- The v3 migration is a concrete, honest war story about IndexedDB semantics.
- The absence of both a queue table and merge metadata (no per-field timestamps, no operation log) is the measurable payoff of the ADR 0017 conflict model.
