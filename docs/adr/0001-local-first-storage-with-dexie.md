# 0001 — Local-first storage with Dexie/IndexedDB

- Status: Accepted; amended by [ADR 0020](./0020-the-local-store-seam.md) (the app no longer touches Dexie directly)
- Date: 2026-06-15

## Context

The app must work fully offline as a PWA and remain usable on mobile with no network. Notes, tags, and attachments need durable client-side storage that survives reloads and supports reactive queries so the UI updates as data changes. A future self-hosted server will sync this data, but the device must be the source of truth while offline.

## Decision

Use **IndexedDB** as the local store, accessed through **Dexie** (`src/db/db.ts`, `NotesDB`), with **`dexie-react-hooks` `useLiveQuery`** for reactive reads. All entities (Notes, Tags, NoteTags, Images, Audio, Files) are Dexie tables. The app is local-first: it reads and writes Dexie directly; sync (M5) will reconcile Dexie against the server, not replace it.

## Consequences

- Reactive UI for free via `useLiveQuery`; no separate client cache/state library needed for note data.
- Sync must be designed as reconciliation against Dexie, including conflict resolution and a mutation queue — sync metadata (dirty flags, tombstones) will be added to the schema (see `src/db/PLAN.md`).
- Schema changes require Dexie version bumps + migrations to preserve user data.
- Large attachments stored in IndexedDB raise a Blob-vs-base64 storage decision (deferred to M3).
- Tests need an IndexedDB shim outside the browser — `fake-indexeddb` is already used by the seeder and will back data tests.
