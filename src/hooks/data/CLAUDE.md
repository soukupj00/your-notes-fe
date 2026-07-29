# CLAUDE.md — `src/hooks/data` (data-access hooks)

The React interface to the Dexie layer. Components use these hooks; they should not touch `db` directly. See [`PLAN.md`](./PLAN.md) for upcoming work and [`src/db/CLAUDE.md`](../../db/CLAUDE.md) for the schema.

## Two kinds of hooks

**Reactive reads** — wrap `useLiveQuery` (from `dexie-react-hooks`); the component re-renders automatically when the underlying data changes. They return `[]`/`undefined` until the query resolves.

| Hook | Returns | Notes |
| ------ | --------- | ------- |
| `useNotes()` | `Note[]` | all notes |
| `useNote(id)` | `Note \| null \| undefined` | single note by id |
| `useTags()` | `Tag[]` | all tags |
| `useNoteFeed(scope, query?)` | `{ notes, loading }` | **the** feed query: filters by `scope.state` (indexed) and optional `scope.tagId`, applies the search text within that scope, and orders pinned-first then by recency. Replaced `useSearchNotes`. |
| `useNotesByTag(tagId)` | `Note[]` | notes linked to a tag via `noteTags` |
| `useTagsForNote(noteId)` | `Tag[]` | tags linked to a note via `noteTags` |

**Mutations** — plain async functions returned from a hook (no live query):

| Hook | Functions |
| ------ | ----------- |
| `useNoteActions()` | `createNote(partial)`, `updateNote(id, updates)`, `purgeNote(id)`, `restoreNote(note, removed)` — plus the lifecycle set: `pinNote`/`unpinNote`, `archiveNote`, `trashNote`, `restoreToActive`, `revertLifecycle(id, snapshot)`, `purgeExpiredTrash(graceDays?)`, `emptyTrash()` |
| `useTagActions()` | `createTag(name, color?)`, `updateTag(id, changes)`, `deleteTag(id)`, `mergeTags(sourceId, targetId)`, `addTagToNote(noteId, tagId)`, `removeTagFromNote(noteId, tagId)` |
| `useAttachmentActions()` | `createAttachment(noteId, file, kind?)`, `getAttachment(id)`, `deleteAttachment(id)`, `cloneAttachment(source, noteId)`, `collectOrphans(noteId, referencedIds)`, `collectMissingNoteOrphans()`, `collectStartupOrphans()` |

## Conventions & behaviors

- Mutations set/refresh `updatedAt` and generate `uuid` ids (see `useNoteActions`).
- Relationship-aware deletes run in a `db.transaction('rw', ...)`: `purgeNote` also clears the note's `noteTags` and `attachments`, returning `{ removedTags, removedAttachments }` so callers can pass them (with the captured note) to `restoreNote` for a lossless undo; `deleteTag` clears the tag's `noteTags`.
- **Lifecycle** ([ADR 0009](../../../docs/adr/0009-note-lifecycle-model.md)): the user-facing "delete" is `trashNote`, not `purgeNote`. Every transition returns a `LifecycleSnapshot` of the fields it was about to overwrite (including `updatedAt`); hand that back to `revertLifecycle` to undo it without a trace. `purgeNote` is the irreversible one and undoes via `restoreNote` instead. `purgeExpiredTrash` runs at app start and reclaims trashed notes older than `TRASH_GRACE_DAYS` (30), cascading their attachments.
- `addTagToNote` is idempotent — it checks for an existing `[noteId+tagId]` before inserting.
- **Tags**: `createTag` is idempotent by name, case-insensitively — it returns the existing tag rather than minting a case-variant duplicate, because create-on-the-fly runs from a free-text field.
`updateTag` takes a `{ name?, color? }` patch; a *present* `color: undefined` clears the colour, an absent key leaves it alone.
`mergeTags` reassigns the source's `noteTags` to the target (filtering out notes that already carry the target, since `[noteId+tagId]` is the primary key), then deletes the source — all in one transaction, since a half-merge would drop notes off both tags.
- Search is **client-side and fuzzy** (`src/lib/note-search.ts`, Fuse.js) over the scoped candidate set, fine for local-first scale.
The `state` index cuts the candidates first; the text match itself is not a Dexie index.
`useNoteFeed`'s live query depends on the **scope only** - the query text is applied afterwards against a `useMemo`'d Fuse index, so typing re-scores in memory rather than re-reading IndexedDB per keystroke.
Results come back **relevance-ranked** (header hits beat body hits, typos still match); the pinned-first/recency ordering applies to the *unsearched* feed.
Fuzzy search dropped the old `createdAt`/`updatedAt` substring matching - fuzzy-matching ISO timestamps is noise, and no UI offered date search.
- Search runs *within* the current scope, so trashed notes are unreachable from any view but `/trash` (ADR 0009).

## Known inconsistencies (see PLAN)

- None outstanding. (The old note about `useTagActions` skipping `createdAt`/`updatedAt` no longer applies: every tag write stamps both.)
