# M3 Slice 2 — Audio (record + attach)

- Status: Approved (design), ready for implementation planning
- Date: 2026-07-22
- Milestone: M3 (Attachments & rich media), Slice 2 of N
- Builds on: [M3 Slice 1 spec](./2026-07-21-m3-slice1-attachments-images-design.md) + [plan](../plans/2026-07-21-m3-slice1-attachments-images.md) (merged to `main`)
- Related: [ADR 0007](../../adr/0007-blob-over-base64-for-attachment-payloads.md) (Blob payloads), [ADR 0004](../../adr/0004-canonical-editor-toolbar-pattern.md) (Pattern A toolbar), [CONTEXT.md](../../../CONTEXT.md)

## Goal

Add **audio** as the second attachment media type: users record a voice memo (editor toolbar mic button + inline record widget) or attach an existing audio file (picker / paste / drop), play it back in a custom in-editor player, and see a compact play-chip on the home card that opens the note and best-effort autoplays.

Slice 1 built the attachment foundation (generic `attachments` table, `useAttachmentActions`, GC, delete/undo cascade, `NoteBody` hydration) and proved it end to end with images.
This slice is the first to **reuse** that foundation, and in doing so it **extracts the image-specific mechanics into shared, media-agnostic helpers** so audio (and later video/file) add only a node + a `kind` + their own capture/render UI, with **no duplicated logic**.

## Decisions (the resolved design tree)

### 1. Two entry points: record + attach (recording is the headline)

- **Record:** an editor toolbar **mic button** (Pattern A, like the image button) opens an **inline record widget** (pulsing dot, `mm:ss` elapsed, Stop, Cancel). On Stop the recording becomes an attachment and an audio node is inserted at the cursor.
- **Attach:** an existing audio file via **picker / paste / drop**, routed through the same insertion pipeline images use (with an audio MIME whitelist).

The mobile quick-capture-bar mic shortcut is **explicitly deferred** to a later dedicated slice: after image + audio + file all exist, one "unified capture bar" slice adds image/audio/file buttons to the mobile bar together (avoids touching the capture bar once per media type).

### 2. Reuse the Slice 1 storage foundation as-is

No schema change. `Attachment` already has `kind` and a nullable `duration` column. `useAttachmentActions` already takes `kind`. `deleteNote`/`restoreNote` cascade, `collectOrphans` (close sweep), `collectMissingNoteOrphans` (global sweep), `bodyHasAttachment` / `extractAttachmentIds` (match any `data-attachment-id`) are all media-agnostic and unchanged.

### 3. Extract shared media helpers now (no duplication) — a targeted refactor of Slice 1 code

Slice 1 shipped image-specific code that audio would ~80% duplicate. Per the "always extract, never duplicate" directive, this slice **refactors the shared mechanics out of the image code first**, then builds audio on the extracted core. Image behavior must stay identical (its existing tests are the safety net — refactor under test). The extractions:

- **`useAttachmentObjectUrl(attachmentId)`** — the `attachmentId → getAttachment → Blob → createObjectURL → revoke-on-unmount/id-change` lifecycle, returning a small state (`loading | ready(url, name) | missing`). `ImageNodeView` and the new `AudioNodeView` both consume it; the read-only `NoteBody` path reuses the same resolution logic. (Today this logic is inlined in `ImageNodeView` and duplicated again in `NoteBody`.)
- **`validateAttachmentFile(file, kind)`** — a `kind`-dispatched validator. `image` rules unchanged (whitelist + 10 MB). Add `audio` rules. Replaces the direct `validateImageFile` call in `createAttachment`; `createAttachment(noteId, file, kind)` validates per `kind`. `AttachmentError` codes (`unsupported-type` / `too-large`) reused.
- **Generalized insert pipeline** — `insertImageFiles`/`dedupeForeignImages` become media-agnostic: `insertAttachmentFiles(editor, files, kind, deps)` (filter by `kind`'s MIME prefix, one `getNoteId()` per batch, `createAttachment(noteId, file, kind)`, insert the kind's node) and `dedupeForeignAttachments(editor, deps)` (already walks any attachment node — generalize the node-type check). Image wiring switches to the generalized functions.
- **`createAttachmentNode(config)`** — a factory for the common TipTap node mechanics (the single `attachmentId` attribute, parse/render with **no persisted `src`**, the `getDeps` stable-getter option wiring from Slice 1's frozen-deps fix, `addNodeView`, and the insert command). Image and Audio are both built from it, parameterized by `name`, `kind`, the parse selector / render tag, and the NodeView component. Buttons stay per-type (image = file picker; audio = record + picker).

**Location of the shared helpers** (planning may adjust): a new `src/components/editor/extensions/attachments/` directory holds `createAttachmentNode.ts`, `insert.ts` (generalized pipeline), and `useAttachmentObjectUrl.ts`; `validateAttachmentFile` stays in `src/lib/attachments.ts`. `Image/` and `Audio/` import from there.

Image keeps its existing body serialization (`<img data-attachment-id>`, parse `img[data-attachment-id]`) so already-saved notes are unaffected.

### 4. Audio node + body serialization

- Node `audioAttachment`, `kind: 'audio'`, atom + block + draggable (mirrors image). Command `insertAudioAttachment({ attachmentId })`.
- Body HTML: `<audio data-attachment-id="{uuid}"></audio>` — **no `src`**, id-reference only (ADR 0007). Parse `audio[data-attachment-id]`. `extractAttachmentIds` already matches this (regex over `data-attachment-id="..."`), so GC/sweep work unchanged.

### 5. Recording flow (`useAudioRecorder` + `AudioRecordButton`)

- **`useAudioRecorder()`** hook: state machine `idle → requesting → recording → (stopped|error)`; `start()`, `stop()`, `cancel()`; exposes `status`, `elapsedMs`, `error`. Wraps `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`. Feature-detects support (`window.MediaRecorder` + `MediaRecorder.isTypeSupported`); picks `audio/webm;codecs=opus` when supported, else `audio/mp4` (Safari). Collects `dataavailable` chunks; on stop assembles a `Blob`, and **stops all tracks** on the stream (release the mic). Enforces the **5-minute max duration** (auto-stop).
- **`AudioRecordButton`** (Pattern A custom-component button, like `ImageButton`): renders the mic `ActionButton`; while recording renders the inline widget (pulsing indicator, `mm:ss`, Stop, Cancel). On Stop: `getNoteId()` → wrap the recording `Blob` in `new File([blob], 'recording.<ext>', { type })` → `createAttachment(noteId, file, 'audio')` → `insertAudioAttachment`. Cancel discards (no attachment, tracks stopped).
- **Failure UX:** permission denied, no device, or `MediaRecorder` unsupported → a translated toast (via `deps.onError` / a dedicated code), never a crash. The mic button is disabled/hidden if the API is unsupported.

### 6. Validation & caps (audio)

- **MIME whitelist (attach):** `audio/webm`, `audio/ogg`, `audio/mpeg` (mp3), `audio/mp4` (m4a/aac), `audio/wav`. The recorder's own output mime is always allowed.
- **Size cap:** 25 MB per audio attachment.
- **Recording max duration:** 5 minutes (recorder auto-stops; keeps blob size bounded).
- Store originals (no re-encode). `duration` stored (recorder elapsed for recordings; a temp `<audio>` `loadedmetadata` read for attached files).

### 7. Player — custom, on a native `<audio>` element (no new dependency)

- **In the editor:** `AudioNodeView` uses `useAttachmentObjectUrl(attachmentId)` to get the object URL, feeds a **hidden native `<audio>`** element (free decode/seek/buffer engine), and renders a **custom themed control row**: play/pause toggle, `mm:ss / mm:ss` time, and a seek scrubber (`input[type=range]` bound to `currentTime`/`duration` via `timeupdate`). Accessible (labelled controls, keyboard-operable). Loading placeholder while the blob resolves; a broken/"unavailable" state if the row is missing (i18n, like the image slice's fix). Object URL revoked on unmount.
- No library: `react-h5-audio-player` would fight our OKLCH theme; `wavesurfer.js` (waveform) is heavier and deferred as a future enhancement.

### 8. Read-only card rendering + best-effort autoplay-on-open

- **`NoteBody`** (read-only) renders an `<audio data-attachment-id>` as a **compact play-chip** (mic icon + `duration`, e.g. `🎙 0:14`) with a **play affordance** — not an inline player (keeps masonry previews quiet). Generalize `NoteBody`'s hydration to branch by element (`img` → resolve object URL into `src`; `audio` → render the chip). The chip needs only the stored `duration` (read via `getAttachment(id)` metadata) — **no object URL is created in the card** (playback happens after opening the note), so no per-card object-URL lifecycle to manage.
- **Autoplay handshake:** tapping the card chip's play button opens the note (`onSelect(id, { autoplayFirstAudio: true })`) → `NotesHome` threads the intent → `NoteEditorDialog` signals the first `audioAttachment` NodeView to `play()`. **Best-effort:** mobile browsers may block autoplay if the user-gesture activation lapses across the async open; on block, the note is simply open with the first player focused/ready. Documented as revisable.

### 9. Empty-note definition already covered

`bodyHasAttachment` already returns true for any `data-attachment-id`, so an audio-only note counts as content (Slice 1's dialog fix). No change needed. (Add an audio-only case to the dialog test for regression safety.)

## Data model changes

None. Reuse `Attachment` (`kind: 'audio'`, `duration`, `mime`, `blob`). No Dexie version bump.

## Component touch-points

**New:**
- `src/components/editor/extensions/Audio/Audio.ts` — `audioAttachment` node via `createAttachmentNode`.
- `src/components/editor/extensions/Audio/AudioNodeView.tsx` — custom player.
- `src/components/editor/extensions/Audio/AudioRecordButton.tsx` — toolbar mic button + inline record widget.
- `src/components/editor/extensions/Audio/useAudioRecorder.ts` — recording state machine.
- `src/components/editor/extensions/Audio/index.ts`.
- New icons in `icons.ts` (mic, play, pause, stop — string keys).

**Extracted / refactored (shared, touches Slice 1 code — keep image behavior identical):**
- `src/components/editor/extensions/attachment-object-url.ts` (or a `hooks/` location) — `useAttachmentObjectUrl`.
- `src/lib/attachments.ts` — `validateAttachmentFile(file, kind)` (generalize `validateImageFile`).
- `src/components/editor/extensions/<shared>/insert.ts` — generalized `insertAttachmentFiles` / `dedupeForeignAttachments`.
- `src/components/editor/extensions/<shared>/createAttachmentNode.ts` — node factory.
- `src/components/editor/extensions/Image/*` — refactor to consume the shared helpers.
- `src/components/NoteBody.tsx` — branch img vs audio; reuse shared resolution.
- `src/hooks/data/useAttachmentActions.ts` — `createAttachment` validates via `validateAttachmentFile(file, kind)`.
- `src/components/cards/NoteCard.tsx` + `src/components/notes/NotesHome.tsx` + `NoteEditorDialog.tsx` — autoplay-on-open intent thread.
- `editor.tsx` — register `audioAttachment`; add the mic button to a toolbar section; extend paste/drop to audio.
- i18n en/cs — mic tooltip, record widget labels, audio validation + permission toasts, player a11y labels, "audio unavailable".

## Testing (pragmatic TDD, per ADR 0003)

- **Refactor-under-test:** the shared extractions must keep all existing image tests green (that is the safety net); run them first (RED stays impossible — behavior preserved).
- **Data/validation:** `validateAttachmentFile(file, 'audio')` (MIME reject, 25 MB reject, boundary pass); `createAttachment(..., 'audio')` round-trip; delete/undo cascade + `collectOrphans` already covered generically (add an audio row to one cascade test). Blob-identity round-trip tests use the **`// @vitest-environment node`** split (jsdom returns a DB-read Blob as a plain object — see project memory); hook/component tests stay jsdom and assert scalar fields / in-memory blobs only.
- **Node:** `audioAttachment` parse/render round-trip keeps `data-attachment-id`, persists no `src`; `insertAudioAttachment` inserts; button factory exposes the mic tooltip (headless, like `Bold.test.ts`).
- **Player:** `AudioNodeView` resolves a fake Blob to the hidden `<audio>` src and revokes on unmount (mock `URL.createObjectURL`/`revokeObjectURL`); play/pause toggles; time renders.
- **Recorder:** `useAudioRecorder` with **mocked** `getUserMedia` + `MediaRecorder` (absent in jsdom): start→recording→stop yields a Blob and stops tracks; permission-denied → error state; unsupported → disabled. `AudioRecordButton` stop → `createAttachment('audio')` + insert.
- **Read-only:** `NoteBody` renders an audio chip for `<audio data-attachment-id>`; the autoplay intent reaches the dialog (best-effort play attempted).
- **`erasableSyntaxOnly: true`** — no TS constructor parameter-property shorthand (see project memory).
- **Cross-task integration check** (the Slice 1 lesson): explicitly verify an audio-only note renders on the card (not a blank card) and survives close — the class of bug the whole-branch review caught last slice.

## Acceptance criteria

1. Record via the mic button → audio node renders a working custom player in the editor and persists across reload.
2. Attach an audio file via picker / paste / drop → same result.
3. `Note.body` contains `<audio data-attachment-id>` with no `src`/base64; bytes live in `attachments` with `kind: 'audio'` + `duration`.
4. The home card shows a compact audio play-chip (not a broken/blank card); its play button opens the note and best-effort autoplays the first audio.
5. Remove audio + in-editor undo restores it; remove + close reclaims the blob (GC). Delete note + Undo restores note **and** its audio.
6. An audio-only note (no text) saves and survives close.
7. Oversized / disallowed-type audio rejected with a toast; mic permission denied / unsupported degrades to a toast, never a crash; the mic stream is released (tracks stopped) after stop/cancel.
8. **No duplicated media logic:** image and audio share `useAttachmentObjectUrl`, `validateAttachmentFile`, the insert pipeline, and `createAttachmentNode`; all pre-existing image tests still pass after the refactor.
9. `pnpm check` + `pnpm test` (new tests included) + `pnpm build` all green.

## Deferred (explicitly out of Slice 2)

- Mobile quick-capture-bar buttons (image + audio + file together) → dedicated "unified capture bar" slice after all media types exist.
- Waveform / level-meter visualization (`wavesurfer.js`) → future enhancement.
- Trimming / editing recordings; playback speed; background/looping.
- Video, File, Excalidraw media types → their own slices, reusing this (now-shared) core.
- Slice 1 carry-forward (startup GC sweep for crash/hard-close orphans) → separate tracked follow-up, not this slice.
