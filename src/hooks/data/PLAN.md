# PLAN — `src/hooks/data`

What's left in the data-access layer. See [root PLAN.md](../../../PLAN.md) for milestone context.

## Cleanups (M1, alongside data tests)

- Unify timestamp handling: `createTag`/`addTagToNote` must set `createdAt`/`updatedAt` like `useNoteActions` does, or the models should make them optional — pick one and apply consistently.
- Add hook tests (Vitest + `fake-indexeddb`): live-query hooks return seeded data and react to mutations; mutation hooks enforce idempotency and cascade behavior.

## Notes CRUD support (M2)

- Attachment actions: hooks to add/remove `images`/`audios`/`files` for a note (mirrors `useNoteActions`), backed by the attachment tables.
- Optimistic updates where useful for snappy mobile UX (live queries already cover most cases).

## Sync integration (M5)

- An offline **mutation queue**: mutations enqueue an intent (create/update/delete) when offline and replay on reconnect.
- Hooks expose per-entity sync state (pending/synced/conflict) so the UI can surface it.
- Conflict resolution surfaced through these hooks rather than scattered in components.
