# CLAUDE.md - `src/hooks/data` (data-access hooks)

The React interface to the Local Store.
Components use these hooks and never touch the store directly.
The store itself is described in [`src/data/CLAUDE.md`](../../data/CLAUDE.md).

## The hooks

**Live reads** wrap `useLive` over a `Live<T>` from the store, so the component re-renders when the data changes.

| Hook | Returns |
| ---- | ------- |
| `useNoteFeed(scope, search?)` | the feed: the Notes of one lifecycle state (and optionally one Tag), searched, sorted and ranked |
| `useTags()` | every Tag, in Label order |
| `useTagNoteCounts()` | per Tag, how many of its Notes are not in the trash |
| `useTagsForNote(noteId)` | one Note's Tags |
| `useNoteAttachments(noteId)` | one Note's Attachments, by id |
| `useAttachmentsByNote(noteIds)` | the same for a whole feed, in one query |

**Mutations** are plain async functions returned from a hook.

| Hook | Does |
| ---- | ---- |
| `useNoteActions()` | create, update, purge and restore, plus the lifecycle moves (pin, archive, trash, restore, empty trash) |
| `useTagActions()` | create, update, delete, merge, move and arrange, and link or unlink a Tag and a Note |
| `useAttachmentActions()` | create, read, update, delete, clone, and the two orphan sweeps |

## Behaviour worth knowing

- **Rows are born through `lib/rows.ts`**, which mints the id and stamps both timestamps; a later write stamps `updatedAt` in the hook.
  `createNote` also accepts an id, which is how a Draft keeps the id its URL already shows ([ADR 0014](../../../docs/adr/0014-the-open-note-lives-in-the-url.md)).
- **"Delete" is `trashNote`, not `purgeNote`** ([ADR 0009](../../../docs/adr/0009-note-lifecycle-model.md)).
  Every lifecycle move returns a snapshot of the fields it overwrote; hand it to `revertLifecycle` to undo without a trace.
  `purgeNote` is the irreversible one: it removes the Note with its links and Attachments in one store call and returns what it removed, so `restoreNote` can undo it losslessly.
  Trashed Notes older than the grace period are purged at app start.
- **Tags.**
  `createTag` is idempotent by name, case-insensitively, because create-on-the-fly runs from a free-text field.
  In `updateTag`, a present `color: undefined` clears the colour and an absent key leaves it alone.
  `mergeTags` is one transaction, since half a merge would drop Notes off both Tags.
- **Orphans.**
  `collectOrphans` sweeps one Note's unreferenced Attachments when its editor closes.
  `collectStartupOrphans` asks the same question of every row in one pass over both tables at app start, instead of one sweep per Note.

### The feed

- **Search is client-side and fuzzy** (`src/lib/note-search.ts`, Fuse.js).
  The live query depends on the scope only; the query text is applied afterwards in memory, so typing does not re-read IndexedDB per keystroke.
  A searched feed is ranked by relevance; an unsearched one by the sort.
- **Sort and filters come from the URL** (`src/lib/note-search-params.ts`).
  Several `tags` narrow with AND, and are applied to the results, so toggling a filter keeps the relevance order.
- **Pinned Notes always head the feed**, under any sort or search, newest pin first.
- **Membership is live, rank is held** ([ADR 0012](../../../docs/adr/0012-feed-rank-is-held-membership-is-live.md)).
  Every write bumps `updatedAt`, so on the default sort the wall would re-order itself whenever a card was recoloured, a box ticked or the open editor autosaved.
  Notes still join and leave at once; what is held is where the ones already on screen sit.
  The order is re-taken only when the user is not watching: on mount, on a search-param change, and on returning to the tab.
  When the editor closes, the Note that was open, and only it, takes its sorted place ([ADR 0025](../../../docs/adr/0025-the-closed-note-takes-its-sorted-place.md)).
  It is recorded before pinned Notes are floated, which is what keeps pinning live.
  `mergeHeldOrder` (`src/lib/feed-rank.ts`) is the pure part and is tested on its own.
- Search runs within the current scope, so trashed Notes are reachable only from `/trash`.

### Attachments on the feed

`NoteFeed` joins Attachments once for the whole feed (`useAttachmentsByNote`) and passes each Note's rows down to its Card; a Card outside a feed resolves its own.

**The batched hook keeps each Note's `Map` identity across refires, and that is load-bearing.**
The one shared query refires for any Attachment write, and the Card mints object URLs off that Map, so a fresh Map would revoke and re-mint every thumbnail on screen.
`useNoteAttachments.test.ts` locks it; do not simplify the cache away.

## Considered and not built

Per-row sync state (dirty, synced, conflicted) on the hooks.
The app shows one pending count from `SyncProvider`, and a conflict arrives as an ordinary Note under the Conflicts Tag.
