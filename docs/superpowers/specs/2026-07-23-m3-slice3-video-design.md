# M3 Slice 3 - Inline video attachments

## Context

M3 adds attachments and rich media.
Slice 1 shipped inline images and the storage foundation (generic `attachments` Dexie table, `useAttachmentActions`, cascade delete/undo, orphan GC).
Slice 2 shipped inline audio and, in the process, extracted a **media-agnostic core** under `src/components/editor/extensions/attachments/` (`createAttachmentNode`, `useAttachmentObjectUrl`, `insert.ts`, `deps.ts`).
The editor's own `CLAUDE.md` already states the intent: "a future Video/File node should extend [the core] the same way rather than duplicating node/insertion logic."

Slice 3 adds **inline video** on top of that core.
It is a thin extension that mirrors audio almost exactly, with the differences driven by video being a visual medium.

## Scope

**In scope**

- A custom `videoAttachment` TipTap node (atom, block, draggable) carrying only `attachmentId` (no persisted `src`), built on `createAttachmentNode`.
- File attachment via toolbar picker, paste, and drop, through the shared `insertAttachmentFiles` pipeline.
- An in-editor NodeView using a **native `<video controls>`** element resolved to a Blob object URL, with the same delete affordance as audio.
- A home-card **play-button affordance** (no inline player), mirroring audio, laid out so audio and video buttons coexist without overlapping.
- Validation (MIME whitelist + size cap) for `kind: 'video'`.
- Tests landing in the same change (pragmatic TDD).

**Explicitly out of scope (deferred to later M3 sub-slices)**

- In-app camera recording (the video equivalent of `useAudioRecorder`).
- Poster/thumbnail generation and inline card preview.
- Metadata extraction (`duration`, `width`, `height`).

## Design

### 1. Node - `extensions/Video/Video.ts` (fills the existing empty stub)

`createVideo(getDeps)` calls `createAttachmentNode(getDeps, config)`, exactly like `createAudio`:

- `name: 'videoAttachment'`
- `parseTag: 'video[data-attachment-id]'`, `renderTag: 'video'`
- `insertCommandName: 'insertVideoAttachment'`
- `nodeView: VideoNodeView`
- `button`: `{ component: VideoButton, componentProps: { editor, getDeps, tooltip: t('editor.video.tooltip') } }`

The `Commands` module augmentation declares `videoAttachment.insertVideoAttachment`.
`extensions/Video/index.ts` re-exports `createVideo`.

### 2. NodeView - `extensions/Video/VideoNodeView.tsx`

Unlike `AudioNodeView` (hidden `<audio>` + hand-built controls), video renders a **native `<video controls playsInline preload="metadata">`** at the object URL from the shared `useAttachmentObjectUrl(attachmentId, deps.getAttachment)` hook.
Rationale: native controls give scrubbing, fullscreen, volume, and mute for free, and video needs a visible frame regardless.

- Wrapper: `NodeViewWrapper as="div" className="my-2" data-drag-handle`.
- Video element: `max-w-full rounded`, `controls`, `playsInline`, `preload="metadata"`.
- **Delete button**: identical to audio - shown only when `props.editor?.isEditable`, calls `props.deleteNode()`, `aria-label={deps.t('editor.video.delete')}`.
- **Missing state**: same "unavailable" dashed box as audio when `state.status === 'missing'`, using `deps.t('editor.video.unavailable')`, with the delete button.
- No autoplay storage flag (video has no autoplay-on-open behavior).

### 3. Toolbar button - `extensions/Video/VideoButton.tsx`

A copy of `ImageButton`:

- Renders an `ActionButton` (icon `FileVideo`) plus a hidden `<input type="file" accept={ALLOWED_VIDEO_MIME.join(',')} multiple>`.
- On change, resolves deps at click time and runs `insertAttachmentFiles(editor, files, 'video', getDeps(), (id) => editor.chain().focus().insertVideoAttachment({ attachmentId: id }).run())`, then clears `e.target.value` to allow re-picking the same file.
- `accept="video/*"` gives mobile the native camera-capture option for free.

Both Lucide icons this slice needs - `FileVideo` (toolbar button) and `Video` (card button) - are added to `src/components/icons/icons.ts`.

### 4. Validation - `lib/attachments.ts`

Add:

```ts
export const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
] as const;

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
```

Extend `validateAttachmentFile`'s `video` branch (currently returns `'unsupported-type'`): strip the codec param (`file.type.split(';')[0].trim()`, same as audio), whitelist-check against `ALLOWED_VIDEO_MIME`, then size-check against `MAX_VIDEO_BYTES`.

### 5. Insert pipeline - `extensions/attachments/insert.ts`

One line: add `video: 'video/'` to `MIME_PREFIX`.
`dedupeForeignAttachments`, clone, and GC already key off `data-attachment-id` and need no change.

### 6. Editor wiring - `editor.tsx`

- Register `createVideo(getAttachmentDeps)` in the extensions array (after `createAudio`).
- Add a `video/` branch to both `handlePaste` and `handleDrop`, parallel to the audio branches, calling `insertAttachmentFiles(..., 'video', ...)` with `insertVideoAttachment`.

### 7. Home card - `NoteCard.tsx`, `lib/attachment-html.ts`, `NoteBody.tsx`

- **`attachment-html.ts`**: add `bodyHasVideo(html)` using a non-global `/<video\b[^>]*\bdata-attachment-id="[^"]+"/i` regex, mirroring `bodyHasAudio`.
- **`NoteBody.tsx`**: strip src-less `<video data-attachment-id>` nodes (same reasoning as audio - the card shows a button, not a broken native player).
- **`NoteCard.tsx`**: the pinned bottom-right control becomes a **flex row** (`absolute right-2 bottom-2 flex gap-2`) so the audio and video buttons coexist without overlapping (today it is a single audio button; a note with both media would collide). The video button uses the `Video` (Lucide) icon - distinct from the audio button's `Play` - `aria-label={t('notes.playVideo')}`, and simply **opens the note** via `onSelect(note.id)` - no autoplay intent (a muted autoplay video is pointless and native controls are present on open).

### 8. i18n - `public/locales/{en,cs}/translation.json`

Add `editor.video.tooltip`, `editor.video.delete`, `editor.video.unavailable`, and `notes.playVideo` to both locales.

## Data flow

Same as audio:

1. User picks/pastes/drops a video file → `insertAttachmentFiles(files, 'video', deps, insertNode)`.
2. Pipeline filters by `video/` prefix, calls `deps.getNoteId()` once, then `deps.createAttachment(noteId, file, 'video')` per file (validation runs inside `createAttachment` via `validateAttachmentFile`).
3. On success, `insertVideoAttachment({ attachmentId })` inserts the node; the bytes live in the `attachments` row (`kind: 'video'`), never in the document JSON.
4. `VideoNodeView` resolves `attachmentId` → Blob object URL for playback; the URL is revoked on unmount/id change by the shared hook.
5. On the home card, `bodyHasVideo` gates a pinned play button that opens the note.

## Error handling

- Invalid MIME / oversize → `AttachmentError` → `deps.onError(code)` → existing translated toast (`unsupported-type`, `too-large`).
- Missing/deleted blob → NodeView "unavailable" box with a delete button.
- Cross-note copy/paste of a foreign video node → existing `dedupeForeignAttachments` clones the row into an owned copy (no new code).

## Testing (same change, pragmatic TDD)

- **`extensions/Video/Video.test.ts`** (headless, `Bold.test.ts` template): parse/render round-trip of `<video data-attachment-id>`, `insertVideoAttachment` command inserts the node, button factory returns the expected `component`/`componentProps`.
- **`extensions/Video/VideoNodeView.test.tsx`**: renders a native `<video>` with the resolved object URL; delete button shown only when editable; `missing` state renders the unavailable box.
- **`lib/attachments.test.ts`**: `validateAttachmentFile(file, 'video')` for unsupported type, oversize, a valid type, and a codec-suffixed type (`video/mp4;codecs=...`).
- **`lib/attachment-html.test.ts`**: `bodyHasVideo` true/false cases.
- **`NoteCard`**: video button present for a video-only body; audio and video buttons coexist for a note with both.

## Assumptions

- **100 MB** per-video cap (`MAX_VIDEO_BYTES`) - a reasonable default for IndexedDB-stored blobs, trivially adjustable.
- Video card button **opens the note without autoplay** (approved during brainstorming).
- No metadata (`duration`/`width`/`height`) is captured this slice; those columns already exist on `Attachment` and are populated in the later processing sub-slice.
