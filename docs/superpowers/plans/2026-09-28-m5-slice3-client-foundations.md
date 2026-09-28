# M5 Slice 3 - Client Foundations - Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Local Store knows what the server is owed (Revisions, dirty rows, Tombstones), the app can talk to a Self-hosted Server (HAL `Remote` and `AccountService`), and a person can create the Owner, pair a Device, join by Invite, and manage Devices from Settings.

**Architecture:** Sync state is store-private.
`rev` and the dirty marker live on the rows in Dexie and beside them in memory, and no read hands them back, so no caller can carry a stale Revision into a write.
The store owns `rev` on every write (it keeps the stored one), marks the row dirty in the same transaction, and a Purge writes a Tombstone carrying the purged row's `rev`.
`sync.dirty()` answers the push batch in the contract's shape; `sync.applied()` records accepted outcomes.
The HTTP side lives in `src/data/http/`: one `fetch` wrapper that follows the HAL root's links, parses every body with the vendored contract, and maps `application/problem+json` to `ProblemError`.

**Spec:** [ADR 0017](../../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md), [ADR 0018](../../adr/0018-the-server-serves-the-pwa.md), [ADR 0020](../../adr/0020-the-local-store-seam.md), [`04-sync.md`](../../architecture/04-sync.md), [`src/data/PLAN.md`](../../../src/data/PLAN.md) "Sync metadata", backend `docs/setup.md` sections 5 to 7 and 10 (the words the screens use).

## Decisions

- **Dirty marker:** `dirty: 1` present or absent, indexed. IndexedDB does not index `undefined`, so `where('dirty').equals(1)` reads exactly the owed rows.
- **Tombstones:** one store keyed by `id`; a NoteTag's id is the contract's `noteTagId(noteId, tagId)`.
  A Note or Tag purge writes one Tombstone and none for its links, because the server cascades them.
  Every purge writes one, `rev` or not: the server accepts a Tombstone for an id it never saw, and skipping it would leave a row on the server if its push was accepted but not yet recorded.
  Re-adding a row (restore, re-link) deletes its Tombstone; `restore` takes the `rev` back from it.
- **The store stamps `deletedAt`** on a Tombstone: it is bookkeeping, not a caller's row.
- **Attachment writes mark the owning Note dirty**, because Attachment metadata rides on the Note's Revision.
- **`replaceAll` (Import)** marks every row dirty, keeps the stored `rev` of an id that existed, writes no Tombstones and drops any pending ones.
  An Import never deletes on the server; slice 4 decides whether that is right.
- **`sync.applied(batch, outcomes)`** handles `accepted` only: it records the `rev`, clears dirty only if the row is still what was pushed (an edit during the push stays owed), and deletes an accepted Tombstone.
  `conflict` and `gone` need the Conflicted Copy and `applyPage`, which are slice 4.
- **No `sync.tombstones()`:** `dirty()` already carries every pending Tombstone.
- **Meta keys:** `SYNC_META_KEYS` in `LocalStore.ts` (`sync.cursor`, `sync.lastSyncedAt`, `sync.accountId`), written by slice 4.
- **QR:** `uqr` (zero dependencies, MIT), because nothing in the tree renders one; its `encode()` matrix is drawn as one SVG path, black on white in both themes, so no markup string is injected.

## Deviations from `PLAN.md` slice 3

- **`SyncProvider` moves to slice 4.** Nothing in this slice runs the loop; the provider would be an empty shell.
- **Members list added mid-slice.** The backend added Owner-only `GET /api/accounts`; `AccountService.accounts()` reads it and the Members section lists every Account with a password reset per member. Its schemas come from the contract, re-pulled at backend `27b8d90`.
- **Sign out does not erase.** It is `DELETE /api/session` only; erase-on-sign-out is slice 4.

## Phase A - sync metadata in the Local Store

- [x] **A1. Dexie v5.** `src/data/dexie/db.ts`: `dirty` index on `notes`, `tags`, `noteTags`; `tombstones: 'id'`. No upgrade (absent `rev` = never pushed, absent `dirty` = clean). Test: `src/data/dexie/sync.migration.test.ts`, a v4 database opened as v5 keeps its rows, none dirty.
- [x] **A2. Interface.** `src/data/LocalStore.ts`: `sync.dirty(): Promise<PushBatch>`, `sync.applied(batch, outcomes)`, `SYNC_META_KEYS`. Shared pure helpers in `src/data/syncRows.ts` (strip, wire Note, outcome pairing).
- [x] **A3. Both implementations.** `src/data/dexie/DexieLocalStore.ts`, `src/data/memory/MemoryLocalStore.ts`.
- [x] **A4. Contract.** `src/data/localStore.sync.contract.ts`, run beside the existing suite from both implementation test files: writes mark dirty, reads never show sync state, attachments dirty their Note, purge / delete / unlink / merge write Tombstones, restore and re-link take them back, `applied` records `rev` and keeps an edit made during the push, `rev` survives `put`, and the Tombstone carries it.
- [x] **A5. Excalidraw write-once.** `commit.ts` always mints a new attachment row; the editor inserts it (new drawing) or repoints the node (`updateAttributes`); the Body's autosave and the note-scoped sweep reclaim the old row. Tests in `commit.test.ts`.

## Phase B - account and pairing

- [x] **B1. HTTP boundary.** `src/data/http/hal.ts`: `createHalClient(fetch, base)`, root links cached, `ProblemError { status, title, detail }`, every body parsed by its contract schema.
- [x] **B2. `HalAccountService`.** `session`, `signIn`, `signOut`, `devices`, `revokeDevice`, `createInvite`, `createDeviceCode`, `setupNeeded`, `setup`, `pair`, `join`, `accounts`, `resetPassword`.
- [x] **B3. `HalRemote`.** `identity`, `push`, `pull` (absent `_links.next` -> `null`, 410 -> `cursor-too-old`), `putBlob`, `getBlob`. No loop.
- [x] **B4. Fake server.** `src/data/http/fakeServer.ts`: a `fetch` over in-memory state whose answers are built with the contract's schemas; tests for both services.
- [x] **B5. Account context.** `src/context/AccountProvider.tsx`: asks `session()` once at startup; `{ status, session, service, refresh }`; a server that does not answer is "no server", and the app renders as before.
- [x] **B6. `/pair`.** `src/routes/pair.tsx` + `src/pages/pair.tsx`: code from the fragment; setup needed -> Owner form; otherwise the Device form, and a 401 there -> the Invite form. Default Device name from the platform (`src/lib/deviceName.ts`). Success -> `/`.
- [x] **B7. Settings.** `src/components/settings/AccountSection.tsx` (sign in / who and which Device / sign out), `DevicesSection.tsx` (list, remove, "Add a Device" QR), `MembersSection.tsx` (Owner: every Account, a password reset per member, "Invite" QR), `PairingQr.tsx`. Placed in the local-data block beside Backup.
- [x] **B8. Tests** for `/pair` and the three sections against the fake server; copy in `public/locales/{en,cs}`.

## Finish

- [x] `pnpm check`, `pnpm lint`, `pnpm build`, `pnpm test`.
- [x] `src/data/CLAUDE.md` (schema v5, `http/`), `src/context/CLAUDE.md`, `src/data/PLAN.md`, root `PLAN.md` (slice 3 ticked, deviations).
