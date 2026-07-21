# M3 Slice 1 — Attachment storage foundation + inline Images

- Status: Approved (design), ready for implementation planning
- Date: 2026-07-21
- Milestone: M3 (Attachments & rich media), Slice 1 of N
- Related: [ADR 0007](../../adr/0007-blob-over-base64-for-attachment-payloads.md), [ADR 0001](../../adr/0001-local-first-storage-with-dexie.md), [ADR 0004](../../adr/0004-canonical-editor-toolbar-pattern.md), [CONTEXT.md](../../../CONTEXT.md)

## Goal

Prove the whole attachment pipeline end to end — editor node → Dexie Blob storage → render (in editor and in read-only previews) → lifecycle/GC — by driving it through the simplest, most common media type: **inline images**.
The storage model, data-layer hooks, and garbage-collection logic built here are written **once** and reused by every later media slice (audio, video, files, Excalidraw), which then only register a new node + `kind`.

M3 is decomposed into vertical slices; this is Slice 1.
Later slices reuse this foundation: Audio (+ mic/photo capture bar shortcut), Video, Files, and Excalidraw (heaviest, last).
Image **downscaling/re-compression** and **thumbnail generation** are deferred to a dedicated later "image processing / preview" slice (candidate: the final slice), because they are the same kind of work (canvas + encode) and add nothing structural here — we store a `Blob` either way, so they reshape nothing.

## Decisions (the resolved design tree)

### 1. Images are inline Body content (not a separate collection)

An Image is a node **inside the Body HTML**, authored via a TipTap extension — not a Google-Keep-style attachment strip rendered outside the Body.
This matches CONTEXT.md ("displayed inline", image insertion framed as an Extension), keeps the editor as the product's center of gravity, and generalizes cleanly to every future media type being an editor node.
Performance is not a factor in this choice: both models store `Blob`s in IndexedDB and both `createObjectURL` to render, so the cost is the same; the expensive anti-pattern (base64 in the Body) is avoided by the reference scheme below regardless.

### 2. Payload is a `Blob` (see ADR 0007)

Attachment bytes are stored as native `Blob`s in IndexedDB, never base64.
Only at the M5 sync boundary (two milestones away) do we encode to a wire format, if needed.

### 3. Reference scheme + source of truth

Two sources of truth, split by concern:

- **Body HTML owns presence + position.** An image is `<img data-attachment-id="{uuid}">` in `Note.body`, with **no `src` persisted**. The set of `data-attachment-id`s in the Body is what determines which images a Note shows and where.
- **The `attachments` table owns the bytes + metadata**, keyed by `id`, indexed by `noteId`.

The embedded `Note.images` / `Note.audio` / `Note.files` arrays are **dropped** — they cannot encode position and keeping them in sync with the Body is pure liability.

### 4. One generic `attachments` table (drops per-type tables)

A single table with a `kind` discriminator replaces the (currently unused, empty) `images` / `audios` / `files` tables.
This dissolves the open "video table vs MIME discriminator" question — video is just `kind: 'video'` — and lets the data-layer hooks, GC sweep, and delete/restore logic be written once for all media types.
Type-specific fields are nullable columns on the one row shape (`width`/`height` for images, `duration` for audio/video).

### 5. Lifecycle: eager-create, never eager-delete, GC-sweep on close

- **Create eagerly.** On insert (picker / paste / drop): validate → write the `attachments` row → insert the `<img data-attachment-id>` node. Writing the row first means autosave can persist a Body that references a real row.
- **Never eager-delete.** Removing an `<img>` from the Body does **not** delete its Blob — TipTap's own undo can re-insert the node, and eager deletion would leave a broken image. Orphans are reclaimed by a sweep instead.
- **GC sweep on dialog close** (after the final autosave flush): delete this Note's `attachments` rows whose `id` no longer appears in the saved Body HTML. By dialog-close the in-editor undo stack is gone, so it is safe. The same sweep rule also reclaims rows whose `noteId` has no corresponding Note (covers a discarded/never-saved draft).
- **Note deletion + undo** mirrors the existing `noteTags` pattern: `deleteNote` gathers and returns the Note's attachment rows and cascade-deletes them **in the same transaction**; `restoreNote` re-`put`s them. This keeps note-level delete/undo lossless without depending on GC timing.
- **Clone-on-insert for foreign images.** If an image node lands in a Note that is not its owner (cross-note copy/paste), mint a fresh row (new `id` + copied `Blob` + this Note's `noteId`) and rewrite the node's `attachmentId`. Keeps every row owned by exactly one Note and the GC sweep trivial. Lowest-frequency path, so it is the least-critical acceptance criterion of the slice — but it is built in Slice 1, not deferred.

### 6. Validation & processing

- **MIME whitelist:** `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/avif`. SVG excluded for now. Anything else → reject with a toast.
- **Size cap:** 10 MB per image → reject oversized with a toast.
- **Store originals.** No downscaling/re-compression in Slice 1 (deferred to the image-processing slice, per Goal). Adding it later reshapes nothing because we already store a `Blob`.

### 7. Insertion UX (Slice 1 scope)

One pipeline `File → validate → createAttachment → insert node`, fed by three entry points:

- **Toolbar button** (Pattern A, custom component — opens a hidden `<input type="file" accept="image/*" multiple>`; new icon in `icons.ts`). Mobile camera comes free via `accept="image/*"`.
- **Paste** (`handlePaste` reads `clipboardData.files`) — table-stakes for screenshots.
- **Drag & drop** (`handleDrop` reads `dataTransfer.files`).

Deferred to a later slice: a dedicated **photo-capture button in the mobile quick-capture bar** (the M2.5 "photo capture → M3" item) — it is a separate UI surface outside the editor.

### 8. Rendering — two paths

- **In the editor:** a custom TipTap `Node` (atom, block, `draggable`, one attribute `attachmentId`) with `parseHTML: img[data-attachment-id]`, `renderHTML → ['img', { 'data-attachment-id': id }]` (no `src`), and `addNodeView: ReactNodeViewRenderer(ImageNodeView)`. The React view resolves `attachmentId → Blob → createObjectURL`, sets `src`, revokes on unmount, shows a placeholder while loading and a broken-state if the row is missing. We build a **custom node**, not `@tiptap/extension-image` (which persists `src`).
- **In read-only previews:** a new shared `<NoteBody html={...} />` component replaces the ad-hoc `dangerouslySetInnerHTML` in `NoteCard`. It sets innerHTML, then an effect walks `img[data-attachment-id]`, resolves Blobs → object URLs (lazy via `loading="lazy"`), and revokes on unmount. One place turns `attachmentId → object URL` for the non-editor path; reusable by any future read-only Note view.

### 9. Empty-note definition must count an attachment as content

`isEmpty` currently collapses a Body to text via `stripHtml`, so an image-only Body reads as empty and the Note is auto-discarded on close (and skipped by autosave).
Redefine: a Note is empty only if it has no header, no Body text, **and no attachment nodes**.
Add `bodyHasAttachment(body)` (true if the HTML contains an `<img data-attachment-id>`, later generalized to any attachment node) and OR it into the content test.
This fixes both `NoteEditorDialog` paths (autosave-skip at line 104, auto-discard at line 117).

## Data model changes

`src/models.ts`:

- **Remove** `NoteImage`, `NoteAudio`, `NoteFile`, and the `Note.images` / `Note.audio` / `Note.files` embedded arrays.
- **Add** `Attachment`:

```ts
export type AttachmentKind = 'image' | 'audio' | 'video' | 'file'; // grows per slice
export interface Attachment {
  id: string;          // uuid v4
  noteId: string;      // FK to Note.id
  kind: AttachmentKind;
  mime: string;        // e.g. 'image/png'
  blob: Blob;          // the bytes (ADR 0007)
  name?: string;       // original filename
  size?: number;       // bytes
  width?: number;      // image/video
  height?: number;     // image/video
  duration?: number;   // audio/video (later slices)
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```

## Schema migration (`src/db/db.ts`)

Bump Dexie `version(1)` → add `version(2)`:

- Add `attachments: 'id, noteId, kind'`.
- Drop the empty per-type tables: `images: null`, `audios: null`, `files: null`.
- No data migration needed — those tables were never populated by shipped UI.
- Update the `NotesDB` class table fields accordingly (`attachments!: Table<Attachment, string>`; remove `images`/`audios`/`files`).

## Data-layer API (`src/hooks/data`)

New `useAttachmentActions()` (mutations, mirrors `useNoteActions`, memoized over the stable `db`):

- `createAttachment(noteId, file): Promise<Attachment>` — validate MIME + size, write the row, return it.
- `getAttachment(id): Promise<Attachment | undefined>` — one-shot read (a Blob never changes after write; no live query needed). Used by `ImageNodeView` and `<NoteBody>`.
- `deleteAttachment(id): Promise<void>` — direct removal (clone-on-insert cleanup, etc.).
- `collectOrphans(noteId, referencedIds): Promise<number>` — GC sweep for a Note; a global variant reclaims rows whose Note is missing.

Changes to `useNoteActions`:

- `deleteNote(id)` return shape changes from `NoteTag[]` to `{ removedTags: NoteTag[]; removedAttachments: Attachment[] }`; it gathers + cascade-deletes attachments in the existing `rw` transaction.
- `restoreNote(note, { removedTags, removedAttachments })` re-`put`s both.
- Ripple to callers: `NoteCard.handleDelete` and any `NoteEditorDialog` delete path.

## Component touch-points

- `src/components/editor/extensions/Image/Image.ts` (currently empty) — the custom node + Pattern A toolbar button.
- New `ImageNodeView` React component (editor render path).
- New `src/components/.../NoteBody.tsx` — shared read-only hydrating renderer; `NoteCard` switches from `dangerouslySetInnerHTML` to it.
- `editor.tsx` — register the `Image` node; wire paste/drop handlers; add the toolbar button to a section.
- `src/components/icons/icons.ts` — add the image icon (`ImagePlus`).
- `NoteEditorDialog` — `isEmpty`/`bodyHasAttachment` fix; call `collectOrphans` on close after the autosave flush.
- i18n: tooltip/label strings for the image button + validation toasts (en/cs).

## Testing (pragmatic TDD, per ADR 0003)

Test-first for logic/data/behavior; build-then-lock for pure visuals.

- **Data layer** (`fake-indexeddb`): `createAttachment` validation (MIME/size reject), round-trip `getAttachment`, `deleteAttachment`, cascade delete via `deleteNote` + lossless `restoreNote`, `collectOrphans` (removes unreferenced + missing-note rows, keeps referenced), clone-on-insert produces a distinct row.
- **Extension** (headless, per the `Bold.test.ts` template): `parseHTML`/`renderHTML` round-trip keeps `data-attachment-id` and persists no `src`; the insert command adds the node; the button factory exposes the right `icon`/`tooltip`.
- **Component** (RTL): `ImageNodeView` resolves a fake `Blob` to an `<img src>` and revokes on unmount; `<NoteBody>` hydrates `data-attachment-id` images; the `isEmpty`/`bodyHasAttachment` fix keeps an image-only note.
- Playwright E2E remains deferred (manual UI verification), consistent with the repo.

## Acceptance criteria

1. Insert an image via toolbar / paste / drop → it renders in the editor and persists across reload.
2. `Note.body` contains `<img data-attachment-id>` with **no** base64/`src`; bytes live in `attachments`.
3. The image renders on the home card (via `<NoteBody>`), not a broken-image icon.
4. Removing an image then undoing (in-editor) restores it; removing it then closing reclaims the Blob (GC).
5. Deleting a note with an image then choosing Undo restores the note **and** its image.
6. An image-only note (no text) saves and survives close.
7. Oversized / disallowed-type files are rejected with a toast; nothing is written.
8. Cross-note paste of an image produces an independent copy (owner-scoped row).
9. `pnpm test` green (new tests included); `pnpm build` / typecheck clean.

## Deferred (explicitly out of Slice 1)

- Image downscaling/re-compression and thumbnail generation → dedicated image-processing/preview slice (candidate: final slice).
- Dedicated mobile quick-capture-bar photo button → later slice.
- Image resize/alignment controls in the editor.
- Audio, Video, File, Excalidraw media types → their own slices, reusing this foundation.
