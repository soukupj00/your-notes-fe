# CLAUDE.md — `src/hooks/data` (data-access hooks)

The React interface to the Dexie layer. Components use these hooks; they should not touch `db` directly. See [`PLAN.md`](./PLAN.md) for upcoming work and [`src/db/CLAUDE.md`](../../db/CLAUDE.md) for the schema.

## Two kinds of hooks

**Reactive reads** — wrap `useLiveQuery` (from `dexie-react-hooks`); the component re-renders automatically when the underlying data changes. They return `[]`/`undefined` until the query resolves.

| Hook | Returns | Notes |
| ------ | --------- | ------- |
| `useNotes()` | `Note[]` | all notes |
| `useNote(id)` | `Note \| null \| undefined` | single note by id |
| `useTags()` | `Tag[]` | all tags |
| `useSearchNotes(query)` | `Note[]` | case-insensitive in-memory filter over header/description/body/dates **plus** notes whose tags match; de-duplicates results |
| `useNotesByTag(tagId)` | `Note[]` | notes linked to a tag via `noteTags` |
| `useTagsForNote(noteId)` | `Tag[]` | tags linked to a note via `noteTags` |

**Mutations** — plain async functions returned from a hook (no live query):

| Hook | Functions |
| ------ | ----------- |
| `useNoteActions()` | `createNote(partial)`, `updateNote(id, updates)`, `purgeNote(id)`, `restoreNote(note, removed)` — plus the lifecycle set: `pinNote`/`unpinNote`, `archiveNote`, `trashNote`, `restoreToActive`, `revertLifecycle(id, snapshot)`, `purgeExpiredTrash(graceDays?)`, `emptyTrash()` |
| `useTagActions()` | `createTag(name)`, `updateTag(id, name)`, `deleteTag(id)`, `addTagToNote(noteId, tagId)`, `removeTagFromNote(noteId, tagId)` |
| `useAttachmentActions()` | `createAttachment(noteId, file, kind?)`, `getAttachment(id)`, `deleteAttachment(id)`, `cloneAttachment(source, noteId)`, `collectOrphans(noteId, referencedIds)`, `collectMissingNoteOrphans()`, `collectStartupOrphans()` |

## Conventions & behaviors

- Mutations set/refresh `updatedAt` and generate `uuid` ids (see `useNoteActions`).
- Relationship-aware deletes run in a `db.transaction('rw', ...)`: `purgeNote` also clears the note's `noteTags` and `attachments`, returning `{ removedTags, removedAttachments }` so callers can pass them (with the captured note) to `restoreNote` for a lossless undo; `deleteTag` clears the tag's `noteTags`.
- **Lifecycle** ([ADR 0009](../../../docs/adr/0009-note-lifecycle-model.md)): the user-facing "delete" is `trashNote`, not `purgeNote`. Every transition returns a `LifecycleSnapshot` of the fields it was about to overwrite (including `updatedAt`); hand that back to `revertLifecycle` to undo it without a trace. `purgeNote` is the irreversible one and undoes via `restoreNote` instead. `purgeExpiredTrash` runs at app start and reclaims trashed notes older than `TRASH_GRACE_DAYS` (30), cascading their attachments.
- `addTagToNote` is idempotent — it checks for an existing `[noteId+tagId]` before inserting.
- Search is **client-side and linear** (`db.notes.toArray()` then `.filter`), fine for local-first scale but not indexed.

## Known inconsistencies (see PLAN)

- `useTagActions.createTag` and `addTagToNote` create rows **without** `createdAt`/`updatedAt`, which the `Tag`/`NoteTag` models declare as required. `useNoteActions` does set them. This should be unified.
