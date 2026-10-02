# PLAN — `src/hooks/data`

What's left in the data-access layer. See [root PLAN.md](../../../PLAN.md) for milestone context.

## Cleanups (M1, alongside data tests)

- Add hook tests (Vitest + `fake-indexeddb`): live-query hooks return seeded data and react to mutations; mutation hooks enforce idempotency and cascade behavior.

## Notes CRUD support (M2)

- Attachment actions: hooks to add/remove `images`/`audios`/`files` for a note (mirrors `useNoteActions`), backed by the attachment tables.
- Optimistic updates where useful for snappy mobile UX (live queries already cover most cases).

## The Local Store seam (M5 slice 1)

Every hook here keeps its public shape and reroutes its body through `useLocalStore()` / `useLive` ([ADR 0020](../../../docs/adr/0020-the-local-store-seam.md)); search, sort and held rank stay in these hooks, in front of the seam.

## Sync integration (M5 slices 3-5)

> **Corrected 2026-08-12.** This section used to plan an ordered queue of create/update/delete *intents*. Under note-level last-writer-wins ([ADR 0017](../../../docs/adr/0017-note-level-last-writer-wins-with-conflicted-copies.md)) that is both more work and less robust: what the server is owed is the *current state* of each changed row, so ten offline edits to one Note owe one push, and an intent log is a second source of truth that a crash can leave disagreeing with Dexie.

- **Every mutation marks its row dirty**, inside the store method that already writes it. The Offline Mutation Queue is then a `LocalStore` read over the dirty marker (`where('dirty')` in the Dexie implementation), not a table - it cannot drift, because it *is* the data.
- **Hooks expose per-entity sync state** (dirty / synced / conflicted) so the editor's indicator and the card can surface it. "Saved" keeps meaning *saved locally* and is shown separately from sync state; conflating them would make a local-first app lie about its own guarantee.
- **Conflict resolution lives in the sync engine, not in these hooks and not in components.** What lands here is its output: the server's version overwrites the local row, and the losing version is re-inserted as an ordinary Note (a Conflicted Copy) carrying the "Conflicts" tag - which means it arrives through `createNote` + `addTagToNote`, machinery that already exists and is already tested.
- **Adopt-on-first-sign-in** is a bulk mark-dirty over every row of a never-attached database. **Erase-on-sign-out** is a full wipe, blocked while anything is dirty and offering the M4 zip export first ([ADR 0018](../../../docs/adr/0018-the-server-serves-the-pwa.md)).
- **Attachment actions gain a bytes-presence notion** for previews-eager / bytes-on-demand: `getAttachment` must be able to answer "known, but not downloaded" so the node views can render a placeholder rather than a broken element.
