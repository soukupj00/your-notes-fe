# M5 Slice 5 - Attachments - Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attachment bytes reach every Device of the Account: a Device uploads what the server lacks after its push, pulls every Note's Attachment rows as metadata, fetches Previews eagerly and full bytes on demand (or all of them, when the Device is told to keep everything).

**Architecture:** The Local Store learns the rows (metadata from a pulled Note, bytes kept where it has them) and a store-private record of which blob ids the server holds.
`src/sync/attachments.ts` is a pure planner plus a runner over `LocalStore` and `Remote`; the engine calls the runner after the pull.
Node views read their row live and gain a third state, "known but not downloaded".

**Spec:** [ADR 0017](../../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md) (metadata rides on the Note's Revision, bytes write-once by id), [ADR 0007](../../adr/0007-blob-over-base64-for-attachment-payloads.md), [`04-sync.md`](../../architecture/04-sync.md) "Attachment transfer", backend `src/routes/blobs.ts` (repeat PUT 204, 413 over `BLOB_LIMIT_BYTES`, 404 unknown).

## Decisions

- **Wire shape.** `AttachmentMeta` gains `thumbnailId?: Id`, the blob holding the downscaled Preview under its own UUID.
  The backend adds it on `feat/attachment-thumbnail-id`, not yet committed, so the vendored contract carries the backend's exact line with a `TODO contract:pull` note.
  A type-only extension is not enough: `HalRemote` parses every page with the contract, and a Zod object drops keys it does not know.
- **Local row.** `Attachment.blob` is optional (absent = known but not downloaded); `thumbnailId?` is minted wherever a thumbnail is written (image insert, video poster) and lazily by the upload step for older rows.
  `dexie/db.ts` indexes only `id, noteId, kind` on `attachments`, so no schema bump.
- **Store-private transfer state** on the attachment row: `onServer?: string[]`, the blob ids the server is known to hold, and `tooLarge?: 1`.
  A list of ids rather than two flags, so a new `thumbnailId` is un-uploaded by construction.
  No read returns them, so a clone (Conflicted Copy, duplicate) never inherits "already uploaded".
- **Store additions** (`sync` half, both implementations, contract cases):
  - `applyPage` writes a pulled Note's `attachments`: a new row without bytes, an existing row takes the server's metadata and keeps its bytes (its thumbnail only while `thumbnailId` is unchanged), a row the Note no longer lists is removed with its bytes. A Note left alone in `keep-local` mode leaves its rows alone too. A Note without an `attachments` array leaves its rows alone.
  - `transfers()`: every row with its bytes, `onServer`, `tooLarge`, and whether its Note is on the server (has a Revision).
  - `onServer(id, blobId)`, `tooLarge(id)`, `received(id, { blob?, thumbnail? })`: none of them owes the Note, because none changes what the Note says.
  - `dirty()` emits `thumbnailId` and never the private fields.
- **Upload** (after the pull, so it never delays a sync's rows): rows whose Note is on the server and that are not `tooLarge`; every thumbnail first, then every full blob.
  A repeat PUT is 204, so a lost `onServer` costs one request.
  `Remote.putBlob` answers `'stored' | 'too-large'`: a 413 is recorded on the row, reported once as "<name> is too large to sync", and never retried.
- **Download.** Every missing thumbnail after each pull; full bytes on demand from the node view (`SyncProvider.download`), or every missing blob after each pull, smallest first, when the Preference `keepEverything` is on.
- **Retry.** A transfer that fails, or a thumbnail the server does not have yet (the other Device uploads after its push, so a hint can arrive first), is counted in `SyncReport.transfersLeft` and the loop's existing back-off runs again.
- **Node views.** `useAttachmentObjectUrl` reads the row live (`watchAttachment`), so a download or a pull re-renders it; `status: 'remote'` carries the row and its thumbnail URL.
  Image: the thumbnail with a download button (the card when there is none); audio, video, file: a placeholder card with name, size and a download button; excalidraw: the inline SVG preview with the same button, and a tap on the surface downloads before it opens the canvas.
  The home card uses thumbnail or preview only and never downloads.
- **Backup.** A row without bytes is exported with `hasBlob: false` and no entry; Import accepts it.

## Tasks

- [x] **1. Contract and model.** `src/contract/index.ts` (`thumbnailId`), `models.ts`, `syncRows.ts` (`attachmentMeta` drops private fields).
- [x] **2. Store.** `LocalStore.ts`, `dexie/`, `memory/`, `localStore.pull.contract.ts` and `localStore.sync.contract.ts` cases.
- [x] **3. Fake server.** Blob store with `PUT` (201, 204 repeat, 413 over `state.blobLimit`, 400 without Content-Type), `GET` and `HEAD` (404 unknown).
- [x] **4. Planner and engine.** `src/sync/attachments.ts` + tests, `engine.ts`, `loop.ts` retry, `Remote.putBlob` result, `HalRemote.ts`; engine tests against the fake.
- [x] **5. UI.** `useAttachmentActions` (mint, watch), node views and the shared not-downloaded card, `CardMedia` without bytes, `SyncProvider.download` and the 413 toast, the `keepEverything` Preference and its Settings row, i18n.
- [x] **6. Backup.** `hasBlob`.
- [x] **7. Two Devices for real.** Backend `pnpm dev` on a scratch `DATA_DIR`, the built PWA, two Playwright contexts.
- [x] **8. Docs.** `src/data/CLAUDE.md` + `PLAN.md`, `src/components/editor/CLAUDE.md`, `src/context/CLAUDE.md`, root `PLAN.md`, `04-sync.md` where it differs.

## Deviations and ceilings

- The vendored contract is edited by one line ahead of a pull (see Wire shape).
- Video posters get a `thumbnailId` as well: they are the same `thumbnail` field, and the backend's orphan sweep keeps any `thumbnailId`.
- An image too small to be given a thumbnail (512px or less) is its own Preview, so the planner fetches it with the thumbnails; otherwise another Device's card would pulse forever.
  ponytail: an image whose thumbnail failed to render comes down at full size the same way.
- The card's per-Note cache keyed rows by `id@updatedAt`, and a download changes bytes without touching `updatedAt`; the signature now includes which bytes a row holds.
  Found in the two-Device run, not by the unit tests.
- A Conflicted Copy or a cross-note paste of a row without bytes fetches them first, because a clone takes a new id nobody else could upload under; if the server does not have them either, the copy keeps the metadata only.
- The fake server cannot check `Content-Length` (a `fetch` body carries none it can see), so only the backend enforces it.
- Transfers per run are sequential and every failure is only counted; a thumbnail the other Device never uploads is asked for again on the back-off, capped at the 5-minute poll.
- Follow-up: `AttachmentChanges` no longer has `blob`, and a `thumbnail` only comes with a new `thumbnailId`, so no id can be given new bytes; the typecheck enforces it, with two `@ts-expect-error` guards in `useAttachmentActions.updateAttachment.test.ts`.
  `thumbnail` stays because the card's video-poster backfill writes one, always under a fresh id.
- Follow-up: an image's and a video's `width` and `height` are now read at insert, from the decode the thumbnail and the poster already do, and every node sets them as attributes, so a not-downloaded thumbnail takes the final size and nothing moves when the bytes land.
  A video's not-downloaded state shows its poster the same way, rather than a card.
  Rows from before keep growing once, when their bytes arrive.

## The two-Device run

Backend `pnpm exec tsx src/main.ts` on a scratch `DATA_DIR` (port 3310), the built PWA under `vite preview` proxying to it (port 4310), two Playwright contexts, at 1280x860 and at 390x844.
A set the Owner up and inserted a 1600x1000 PNG and a 240 kB PDF into a Note; it uploaded the thumbnail, then the image, then the file, and recorded all three on the rows.
B paired with a device code, and its Feed showed the card's thumbnail without opening anything: one `GET`, for the thumbnail.
Opening the Note showed the thumbnail with a download button and the file as a card ("240 kB · Not on this device yet"); each tap fetched one blob and the node turned into the real thing in place.
Turning on "Keep everything on this device" in a third context downloaded both full blobs within seconds.
No spec was committed: `e2e/` runs against `pnpm dev` with no backend.
