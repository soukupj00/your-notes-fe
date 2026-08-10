# CLAUDE.md — `src/hooks/data` (data-access hooks)

The React interface to the Dexie layer. Components use these hooks; they should not touch `db` directly. See [`PLAN.md`](./PLAN.md) for upcoming work and [`src/db/CLAUDE.md`](../../db/CLAUDE.md) for the schema.

## Two kinds of hooks

**Reactive reads** — wrap `useLiveQuery` (from `dexie-react-hooks`); the component re-renders automatically when the underlying data changes. They return `[]`/`undefined` until the query resolves.

| Hook | Returns | Notes |
| ------ | --------- | ------- |
| `useTags()` | `Tag[]` | all tags |
| `useNoteFeed(scope, search?)` | `{ notes, loading }` | **the** feed query: filters by `scope.state` (indexed) and optional `scope.tagId`, then applies the URL search state (`q`, `sort`, `dir`, `tags`) within that scope. Replaced `useSearchNotes`. |
| `useTagsForNote(noteId)` | `Tag[]` | tags linked to a note via `noteTags` |
| `useNoteAttachments(noteId)` | `Map<id, Attachment>` | one note's rows; `null` skips the query |
| `useAttachmentsByNote(noteIds)` | `Map<noteId, Map<id, Attachment>>` | the same join for a whole feed, in **one** query |

**Mutations** — plain async functions returned from a hook (no live query):

| Hook | Functions |
| ------ | ----------- |
| `useNoteActions()` | `createNote(partial)`, `updateNote(id, updates)`, `purgeNote(id)`, `restoreNote(note, removed)` — plus the lifecycle set: `pinNote`/`unpinNote`, `archiveNote`, `trashNote`, `restoreToActive`, `revertLifecycle(id, snapshot)`, `purgeExpiredTrash(graceDays?)`, `emptyTrash()` |
| `useTagActions()` | `createTag(name, color?)`, `updateTag(id, changes)`, `deleteTag(id)`, `mergeTags(sourceId, targetId)`, `addTagToNote(noteId, tagId)`, `removeTagFromNote(noteId, tagId)` |
| `useAttachmentActions()` | `createAttachment(noteId, file, kind?)`, `getAttachment(id)`, `deleteAttachment(id)`, `cloneAttachment(source, noteId)`, `collectOrphans(noteId, referencedIds)`, `collectStartupOrphans()` |

## Conventions & behaviors

- Mutations set/refresh `updatedAt` and generate `uuid` ids (see `useNoteActions`).
`createNote` accepts an `id` instead of minting one, which is how a draft keeps the id its URL is already showing ([ADR 0014](../../../docs/adr/0014-the-open-note-lives-in-the-url.md)): the editor's id goes into the address bar when it opens, before there is a row.
- Relationship-aware deletes run in a `db.transaction('rw', ...)`: `purgeNote` also clears the note's `noteTags` and `attachments`, returning `{ removedTags, removedAttachments }` so callers can pass them (with the captured note) to `restoreNote` for a lossless undo; `deleteTag` clears the tag's `noteTags`.
- `collectStartupOrphans` is **one pass over both tables**, not the note-scoped `collectOrphans` run per note: "the owning Note is gone" and "the owner's Body no longer references this row" are the same question asked of one row, so answering them together costs one transaction instead of one per note on every app start.
`collectOrphans` stays for the note-scoped case (`NoteEditorDialog` on close); the separate missing-owner sweep is gone, folded into the same predicate.
- **Lifecycle** ([ADR 0009](../../../docs/adr/0009-note-lifecycle-model.md)): the user-facing "delete" is `trashNote`, not `purgeNote`. Every transition returns a `LifecycleSnapshot` of the fields it was about to overwrite (including `updatedAt`); hand that back to `revertLifecycle` to undo it without a trace. `purgeNote` is the irreversible one and undoes via `restoreNote` instead. `purgeExpiredTrash` runs at app start and reclaims trashed notes older than `TRASH_GRACE_DAYS` (30), cascading their attachments.
- **Attachments are joined feed-wide, not per card.** `NoteFeed` calls `useAttachmentsByNote(ids)` once and passes each note's rows down through `NoteCard` to `CardMedia`; a card rendered outside a feed still resolves its own via `useNoteAttachments`, the same fallback labels use.
A card whose Body references no attachment opens no query either way.
The batched hook **preserves each note's Map identity** across refires, and that is load-bearing rather than an optimisation: one shared query refires for *any* attachment write, and `CardMedia` mints object URLs off that Map, so handing back a fresh Map would revoke and re-mint every thumbnail on screen - the whole feed flickering because one drawing was saved.
`useNoteAttachments.test.ts` locks the guarantee; do not "simplify" the signature cache away.
- `addTagToNote` is idempotent — it checks for an existing `[noteId+tagId]` before inserting.
- **Tags**: `createTag` is idempotent by name, case-insensitively — it returns the existing tag rather than minting a case-variant duplicate, because create-on-the-fly runs from a free-text field.
`updateTag` takes a `{ name?, color? }` patch; a *present* `color: undefined` clears the colour, an absent key leaves it alone.
`mergeTags` reassigns the source's `noteTags` to the target (filtering out notes that already carry the target, since `[noteId+tagId]` is the primary key), then deletes the source — all in one transaction, since a half-merge would drop notes off both tags.
- Search is **client-side and fuzzy** (`src/lib/note-search.ts`, Fuse.js) over the scoped candidate set, fine for local-first scale.
The `state` index cuts the candidates first; the text match itself is not a Dexie index.
`useNoteFeed`'s live query depends on the **scope only** - the query text is applied afterwards against a `useMemo`'d Fuse index, so typing re-scores in memory rather than re-reading IndexedDB per keystroke.
Results come back **relevance-ranked** (header hits beat body hits, typos still match); the pinned-first/recency ordering applies to the *unsearched* feed.
Fuzzy search dropped the old `createdAt`/`updatedAt` substring matching - fuzzy-matching ISO timestamps is noise, and no UI offered date search.
- **Sort and filters** come from the URL (`src/lib/note-search-params.ts`, via `useNoteSearchState`), so the hook takes a `NoteSearchParams` rather than a bare query string.
Sort is field × direction (`updated`/`created`/`title` × `desc`/`asc`, default `updated`/`desc`); multiple `tags` narrow with **AND**.
Tag filtering is applied to the *results*, not the candidates, so toggling a pill never rebuilds the Fuse index and relevance order survives.
- **Pinned notes always head the feed** - under any sort *and* under a search ranking - and keep their own order (newest pin first) rather than adopting the sort, because a pin shelf is arranged by hand.
- **Membership is live, rank is held** ([ADR 0012](../../../docs/adr/0012-feed-rank-is-held-membership-is-live.md)).
A live query refires for *any* write to the notes table and every mutation bumps `updatedAt`, so on the default `updated desc` sort the wall used to re-order itself the moment a card was recoloured, a checkbox ticked, or the open editor autosaved.
Notes still join and leave the feed at once; what is held is where the ones already on screen sit.
The order is re-taken only when the user is not watching - on mount, on a search-param change, and on returning to the tab (`useVisibilityEpoch`) - all folded into one `rankKey`.
The held order is checked for staleness **inside the memo at read time** rather than reset from an effect: an effect would run after the memo it needs to precede, and resetting during render would be a ref write the lint rules reject.
It is recorded *before* `floatPinned`, which is what keeps pinning live (ADR 0012's one exception) and what lets an unpin actually put the note back rather than stranding it at rank 0.
`mergeHeldOrder` (`src/lib/feed-rank.ts`) is the pure part: incumbents keep their order, and a newcomer is anchored after the last incumbent that outranks it in the fresh order - not simply placed at the front, which would be wrong under `title asc`.
- Search runs *within* the current scope, so trashed notes are unreachable from any view but `/trash` (ADR 0009).

## Known inconsistencies (see PLAN)

- None outstanding. (The old note about `useTagActions` skipping `createdAt`/`updatedAt` no longer applies: every tag write stamps both.)
