# M3 Slice 6 - performance & polish closeout

**Status:** in progress (Tasks 1-5 complete).

**Goal:** Close out M3 with the performance and correctness work that finishes "attachments render fast and don't leak," plus a bounded set of named polish fixes from daily use.
No new media features - those are earmarked for M4.

**Scope decision (the spine):** performance + correctness closeout, *not* a grab-bag of every deferred media idea.
This gives M3 a defensible boundary: attachments work (Slices 1-5), render fast (Task 1), and don't leak (Task 2).
The feature-y media UX (waveform-as-feature, capture bar, resize controls, recording trim, video posters) stays deferred to M4.

## Context

M3 Slices 1-5 shipped (image, audio, video, file, Excalidraw), all on the shared `attachments/` core.
The `flushSync` audio bug is already fixed (`immediatelyRender: false`, `editor.tsx:289`).

Two things turned out to be further along than the older plans recorded, which sharpened the polish tasks:

- The delete control is **already a shared component** (`ConfirmDeleteButton`), consumed by all five NodeViews.
  The remaining problem is inconsistent *placement/prominence*, not a missing abstraction.
- Audio recording is **already a Popover** with a live `RecordingWaveform` visualizer + timer + Stop/Cancel (the async-gliding "deferred popover + waveform" were actually built).
  The remaining problems are the fixed `w-64` width (too small on mobile) and a jumpy visualizer.

## Tasks

Each task is small and independently shippable with its tests, in the project's pragmatic-TDD style.
Finishing all six finishes the slice.

### Task 1 - Image thumbnails (the perf win) ✅

The card feed currently loads the **full-resolution blob** for every image on every card (`NoteBody.tsx` -> `getAttachment` -> `createObjectURL(att.blob)`).
A masonry feed of image-heavy notes loads tens of MB. Downscaled thumbnails fix this.

Decisions (grilled):

- **Storage:** new `Attachment.thumbnail?: Blob` field (Decision A).
  Non-indexed, so **no Dexie version bump / migration** (structured clone stores the whole object).
  Kept as a `Blob`, consistent with [ADR 0007](../../adr/0007-blob-over-base64-for-attachment-payloads.md); Excalidraw's `preview?: string` (SVG) is left unchanged.
  Both fields play the one shared **Preview** role (see the `CONTEXT.md` glossary entry added in this slice), in two physical forms.
- **Generation:** a pure helper `src/lib/image-thumbnail.ts` -> `generateImageThumbnail(blob): Promise<Blob | undefined>`.
  WebP via `canvas.toBlob('image/webp', 0.75)`, longest edge <= 512px, aspect ratio preserved, **never upscale**.
  **Skip generation** (return `undefined`) when the source is already <= 512px on its longest edge - the read-path fallback covers those.
- **When:** at **image insert time only** (mirrors how Excalidraw makes its SVG at save time).
  No lazy backfill and no migration sweep - pre-ship there is no legacy user data to migrate, and dev seed data is disposable.
- **Read path:** `NoteBody` (card path) uses `thumbnail` when present and **falls back to the full blob when it is absent**.
  This is graceful degradation, not backfill: old/failed/synced images just load full-res harmlessly.
  The editor NodeView keeps using the full-res blob (editing quality unchanged).

Called from the **image** insert path only (not the shared media insert), since it is image-specific.

Also in this task: add the **Preview** glossary entry to `CONTEXT.md` and fix the stale "Four kinds" line (it is five kinds now that Excalidraw shipped).

### Task 2 - Comprehensive startup GC sweep (close the crash leak) ✅

Current GC is nearly complete: node-delete + dialog-close runs `collectOrphans`; note-delete cascades with lossless undo; `collectMissingNoteOrphans` (at `NotesHome` mount) drops rows whose note is gone.
The **one remaining leak** is the crash path: delete a node (or add then remove one) and the browser crashes/hard-closes before the dialog close handler runs, so `collectOrphans` never fires; the note still exists, so `collectMissingNoteOrphans` misses it too.
That blob leaks forever.

Fix: upgrade the `NotesHome`-mount sweep to also reconcile **per-note references** - for every note, `collectOrphans(note.id, extractAttachmentIds(note.body))`.
Keep `collectMissingNoteOrphans` for the deleted-note case.
Reuses `extractAttachmentIds` and `collectOrphans` (both exist).
Safe at startup: no live undo stack, and the on-disk body is the saved truth.

> Note: the async-gliding "design smell" (*no GC when a node is removed from the body*) is **already handled** at dialog close and is not a task here.

### Task 3 - Unify delete-button placement + prominence ✅

`ConfirmDeleteButton` is already shared, but placement diverges: Excalidraw overlays it (`absolute top-2 right-2`), while Image passes it inline.

- Make **image / video / file** adopt Excalidraw's **corner overlay** (`absolute top-2 right-2`) with a more prominent, always-legible style (semi-opaque background pill so it reads over any content), all via the existing shared component.
- **Audio** keeps the same shared component but placed **inline at the trailing end of the player row** (audio is a control bar, not a content canvas), so it is "the same button, placed to fit the design."

### Task 4 - Audio recording UI: mobile width + calmer visualizer ✅

Two parts (may be two commits):

- (a) **Mobile layout:** the recording surface is a fixed `w-64` popover - too small on mobile.
  Make it **full-width on mobile** (bottom sheet / full-width surface); keep the compact popover on desktop.
- (b) **Visualizer:** `RecordingWaveform` is a raw time-domain **oscilloscope** redrawn from scratch each `requestAnimationFrame`, which is inherently jittery (`smoothingTimeConstant` does not apply to time-domain data).
  Replace it with a **scrolling RMS/peak amplitude-bar history** (voice-memo style): compute one amplitude value per frame/interval, push a bar, scroll left.
  Calm and readable instead of jumpy.
  Keep the existing AudioContext teardown discipline (context + RAF torn down with the stream).

### Task 5 - Excalidraw card preview rounded corners ✅

The NodeView preview already has `rounded-md`, but the **card path** does not: `NoteBody` injects the stored SVG with `display:block; width:100%` on a container with no rounding/clip, so wide drawings show square corners on the card.
Add `rounded` + `overflow-hidden` to the excalidraw preview container in `NoteBody`.

> Follow-up (same review): the card **image** preview had the identical gap - `NoteBody`'s `<img data-attachment-id>` had no rounding class, unlike the editor's `ImageNodeView` (`rounded-md`). Fixed alongside this task by adding `rounded-md` to the card `<img>` in `NoteBody`, for parity with the editor.

### Task 6 - Harden autoplay-on-open

The autoplay-on-open path (open a note via the card audio chip -> first audio autoplays) has been "fixed twice" and is flagged as fragile/timing-coupled.

Per souki's bug-fix rule: **reproduce end-to-end in the browser first** (systematic-debugging), find the root cause of the fragility, then make the trigger deterministic rather than timing-dependent.
Do not patch symptoms speculatively.

## Deferred to M4 (earmarked, not dismissed)

- **Video poster thumbnails** - the one genuinely useful media preview beyond images (YouTube-style recognition), but heavier (seek-to-frame + canvas, codec caveats) and a *new* inline card preview, so M4.
- Unified mobile quick-capture bar (photo/mic buttons).
- Image resize / alignment controls.
- Recording trim/edit + playback speed.
- **Click-to-zoom image lightbox** (raised during Task 3 review, 2026-07-24): tap/click an image to view it enlarged. Recommended approach when picked up: a native Radix `Dialog` (already in use for `ConfirmDeleteButton`) showing the image near full-viewport size - no new dependency, free accessibility (focus trap, Esc, ARIA). Real pinch-to-zoom/pan is a bigger step up (likely needs a small gesture library) and should be scoped separately if wanted.

## Verification (per task and at slice close)

- `pnpm test` (currently green), `pnpm build`, `pnpm check:ci`.
- Manual browser QA (no Playwright on this project): image cards load fast with thumbnails; delete overlays are consistent and prominent; audio recording is full-width and calm on mobile; Excalidraw card corners are rounded; autoplay-on-open is reliable.
