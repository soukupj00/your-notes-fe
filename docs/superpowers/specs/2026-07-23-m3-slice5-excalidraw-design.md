# M3 Slice 5 - Excalidraw drawing attachments

## Context

M3 adds attachments and rich media.
Slices 1-4 shipped image, audio, video, and file attachments on a **media-agnostic core** (`src/components/editor/extensions/attachments/`: `createAttachmentNode`, `useAttachmentObjectUrl`, `insert.ts`, `deps.ts`) plus a generic `attachments` Dexie table, `useAttachmentActions`, cascade delete/undo, and orphan GC.

Slice 5 adds **inline Excalidraw drawings**.
It is deliberately its **own slice, not folded into Slice 4 (files)**, because it is architecturally different from every prior attachment kind.
Image, audio, video, and file all fit one shape: the user supplies a **pre-existing blob** (pick/paste/drop), we store it once, and every render path is **passive** - it resolves an `attachmentId` to a Blob object URL and displays it.
Excalidraw does **not** fit that shape.
It embeds a **live drawing editor** that *creates and mutates* a scene in place.
There is no source file: insertion starts an **empty** scene; the bytes are a **JSON scene document** the user edits repeatedly after insertion; and the home-card render is a **rendered preview of that specific drawing**, not a generic icon/button.

This slice's job is to add that one interactive, write-back media kind while **reusing the existing core as far as it genuinely fits** and adding only the primitives the interactive/write-back nature actually requires.

### Can the shared core be reused, or is a bespoke node warranted?

**Decision: reuse `createAttachmentNode` unchanged; do not write a bespoke node.**

`createAttachmentNode` provides exactly five node mechanics, and every one of them fits Excalidraw as-is:

1. a single `attachmentId` attribute,
2. id-only parse/render (no inline payload in the document JSON - ADR 0007),
3. the `getDeps` stable-getter option wiring (so button + NodeView read live deps),
4. a React NodeView (arbitrary component - config-supplied),
5. an insert command, including the "drop the NodeSelection and add a trailing paragraph so attachments stack" fix.

None of Excalidraw's differences touch those mechanics. They live entirely **outside** the node factory:

- **Non-file creation** - a toolbar button that mints an *empty* scene attachment instead of running the file pipeline (`insertAttachmentFiles`). This is just a different button component; the factory's `button` slot already accepts any component.
- **Write-back** - the scene is edited after insertion, so the attachment row's blob must be *updated*. This needs one new data-layer primitive (`updateAttachment`) threaded through `AttachmentDeps`; it is orthogonal to the node.
- **A JSON-scene loader** - the NodeView reads the blob as JSON text (`useExcalidrawScene`) rather than as an object URL (`useAttachmentObjectUrl`). A new sibling hook, not a factory change.
- **A stored SVG snapshot** - a new optional `Attachment.preview` field, populated at save-time, for cheap card rendering.

Because the node itself is identical in shape to image/audio/video, a bespoke `Node.create` would duplicate the stacking-insert logic and the `getDeps` wiring for zero benefit.
The Excalidraw node therefore serializes with its **own custom tag** (`<excalidraw-drawing data-attachment-id>`), exactly as audio/video use their own `<audio>`/`<video>` tags - which the factory already supports via its `renderTag`/`parseTag` config with **no code change**.

## Scope

**In scope**

- A custom `excalidrawAttachment` TipTap node (atom, block, draggable) carrying only `attachmentId`, built on the **unchanged** `createAttachmentNode`, serialized as `<excalidraw-drawing data-attachment-id>`.
- A toolbar button that **creates an empty scene** attachment (`kind: 'excalidraw'`, a JSON Blob) and inserts the node - no file picker, no paste/drop.
- An in-editor NodeView that mounts the **interactive `@excalidraw/excalidraw` canvas** for an editable editor, loads the stored scene, and **writes the edited scene back** (debounced) to the same attachment row, regenerating the SVG snapshot on each save.
- A new `updateAttachment` data-layer primitive (on `useAttachmentActions`, threaded into `AttachmentDeps`) for the write-back.
- A new optional `Attachment.preview` field (SVG markup string) storing the rendered snapshot alongside the JSON scene.
- Home-card rendering that injects the **stored SVG snapshot inline** (image-like resolution), never re-mounting the canvas on the feed.
- `kind: 'excalidraw'` added to `AttachmentKind`; `validateAttachmentFile` accepts the internally-generated JSON scene.
- A delete affordance on the editor NodeView using the shared `ConfirmDeleteButton` (Slice 3.5), editable-only, exactly as audio/video/image/file wire it (`onConfirm` calls `props.deleteNode()`).
- Tests landing in the same change (pragmatic TDD).

**Explicitly out of scope**

- Collaborative / multi-user editing of a drawing.
- Embedding images or files *inside* an Excalidraw scene (attaching a photo to a drawing); Excalidraw's own `files` map is persisted verbatim in the scene JSON but no UI is added for it.
- Export to PNG / PDF.
- Shape libraries / presets beyond Excalidraw's built-in defaults.
- Metadata extraction (`width`/`height`) for the scene.

## Design

The Excalidraw-specific differences (creation, write-back, JSON loading, preview) are the interesting part; the node/insert/GC mechanics are inherited unchanged from Slices 1-4 and are only noted where they are touched.

### 1. Dependency - `@excalidraw/excalidraw`

Not currently installed (see `package.json`).
Added as a runtime dependency.
It is a heavy React component library; it is imported **only** by the editor NodeView (the interactive canvas) and by the SVG-snapshot helper (`exportToSvg`) - never by the read-only card path, which uses stored SVG.
`window.EXCALIDRAW_ASSET_PATH` is set (e.g. to `"/"`) so fonts/assets resolve from the app origin under the self-hosted PWA rather than a CDN.

### 2. Model + validation - `src/models.ts`, `src/lib/attachments.ts`

- `AttachmentKind` gains `'excalidraw'`.
- `Attachment` gains `preview?: string` - "excalidraw: a rendered SVG snapshot of the scene, stored at save-time so the home card renders cheaply without re-mounting the canvas" (analogous to how audio stores `duration` alongside the blob). It is a plain (non-indexed) property, so **no Dexie version bump / migration is required** - Dexie stores arbitrary object properties.
- `lib/attachments.ts` adds `EXCALIDRAW_MIME = 'application/json'` and `MAX_EXCALIDRAW_BYTES` (25 MB), and a `'excalidraw'` branch in `validateAttachmentFile` accepting `application/json` under the cap. The scene is internally generated, but creation still flows through `createAttachment` (which always validates), so the branch keeps a single creation path rather than a validation bypass.

### 3. Scene helpers - `extensions/Excalidraw/scene.ts`

Pure/serialization helpers, isolated so the node/button/NodeView stay thin and the JSON shape is tested without mounting the canvas:

- `type ExcalidrawScene = { elements: readonly unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> }`.
- `emptyScene(): ExcalidrawScene` - `{ elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} }`.
- `sceneToFile(scene): File` - `new File([JSON.stringify(scene)], 'drawing.excalidraw.json', { type: 'application/json' })`, reusing the existing Blob-based `attachments` table verbatim.
- `parseScene(text: string): ExcalidrawScene | null` - tolerant `JSON.parse` (returns `null` on malformed JSON so the NodeView can show the "unavailable" state).
- `sceneToSvgString(scene): Promise<string>` - calls `exportToSvg` from `@excalidraw/excalidraw` and serializes the returned `SVGElement` with `XMLSerializer`. The one place that imports the heavy lib for snapshotting.

### 4. Scene loader hook - `extensions/Excalidraw/useExcalidrawScene.ts`

The JSON analogue of `useAttachmentObjectUrl`.
`useExcalidrawScene(attachmentId, getAttachment)` resolves `attachmentId -> Attachment -> parseScene(await blob.text())`, returning `{ status: 'loading' } | { status: 'ready'; scene; attachment } | { status: 'missing' }`.
Unlike the object-URL hook there is no URL to revoke; it is a plain async read guarded by an `active` flag.

### 5. NodeView - `extensions/Excalidraw/ExcalidrawNodeView.tsx`

Two render modes, chosen by `props.editor?.isEditable`:

- **Editable (editor dialog):** mounts `<Excalidraw>` with `initialData` from the loaded scene. An **`onChange` handler, debounced (~800 ms), writes back**: it builds the JSON File, awaits `sceneToSvgString`, and calls `deps.updateAttachment(attachmentId, { blob, preview })`. A pending debounced write is flushed on unmount. The canvas sits in a fixed-height, `resize`-free framed container (`h-[420px]`) so it does not fight the document flow. Includes the **delete button** - the shared `ConfirmDeleteButton` from Slice 3.5 (editable-only, `label={deps.t('editor.excalidraw.delete')}`, `onConfirm={() => props.deleteNode()}`, `t={deps.t}`), identical to how it is wired into audio/video/image: the trash-icon trigger opens a confirm dialog and `deleteNode()` runs only on confirm.
- **Read-only:** renders the stored `attachment.preview` SVG (via `dangerouslySetInnerHTML` on trusted, self-generated markup) instead of mounting the canvas. This path is normally only hit if the editor is non-editable; the home feed does not mount the NodeView at all (see §8).
- **Missing / malformed:** the same dashed "unavailable" box as video (`deps.t('editor.excalidraw.unavailable')`) with the delete button.

Excalidraw is mocked in the NodeView test (jsdom cannot run the real canvas); the test asserts scene load, the write-back call on change, and the missing state.

### 6. Toolbar button - `extensions/Excalidraw/ExcalidrawButton.tsx`

**Not** a file picker - an `ActionButton` (icon `PenTool`) whose action:

1. resolves deps at click time (`const deps = getDeps()`),
2. `const noteId = await deps.getNoteId();` (persists the draft, mirroring `insertAttachmentFiles`),
3. `const att = await deps.createAttachment(noteId, sceneToFile(emptyScene()), 'excalidraw');`
4. `editor.chain().focus().insertExcalidrawAttachment({ attachmentId: att.id }).run();`

Wrapped in try/catch so a creation failure routes through `deps.onError('insert-failed')` (existing translated toast) instead of throwing.
The `PenTool` Lucide icon is added to `src/components/icons/icons.ts`.

### 7. Node + editor wiring - `extensions/Excalidraw/Excalidraw.ts`, `index.ts`, `editor.tsx`, `BlocksSection.tsx`

- `createExcalidraw(getDeps)` calls `createAttachmentNode(getDeps, { name: 'excalidrawAttachment', parseTag: 'excalidraw-drawing[data-attachment-id]', renderTag: 'excalidraw-drawing', insertCommandName: 'insertExcalidrawAttachment', nodeView: ExcalidrawNodeView, button: ... })`, with the `Commands` module augmentation for `excalidrawAttachment.insertExcalidrawAttachment`. `index.ts` re-exports.
- `editor.tsx`: register `createExcalidraw(getAttachmentDeps)` in the extensions array (after `createVideo`); thread `updateAttachment` into the `attachmentDeps` memo. **No paste/drop branch** - Excalidraw drawings are never file-pasted.
- `BlocksSection.tsx`: add `'excalidrawAttachment'` to `BLOCK_EXTENSION_NAMES` so the button surfaces (registering the extension alone does not surface the button - the Slice 3 regression).

### 8. Home card - `NoteBody.tsx` (and *not* `NoteCard.tsx` / `attachment-html.ts`)

This is where Excalidraw's card treatment **diverges from the `bodyHasX` boolean-gate pattern**, and it is worth stating explicitly:

- Audio and video use a **boolean gate**: `NoteCard` calls `bodyHasAudio` / `bodyHasVideo`, renders a single generic play button *outside* `NoteBody`, and `NoteBody` **strips** the src-less `<audio>`/`<video>` nodes (they carry no per-note visual). The card needs no data from the specific attachment - one boolean is enough.
- Excalidraw's card treatment is an **inline, per-attachment rendered preview** - the actual SVG of *that* drawing - so a boolean is insufficient. It follows the **image path** instead: `NoteBody` resolves each `excalidraw-drawing[data-attachment-id]` node by fetching its row and **injecting `attachment.preview`** (the stored SVG) into the element (with a `max-width:100%` wrapper). No boolean gate, no external button, no `bodyHasExcalidraw` helper, and **no `NoteCard` change** (the node carries `data-attachment-id`, so `bodyHasAttachment` already makes `hasBody` true and mounts `NoteBody`).

`attachment-html.ts` therefore gains **nothing** this slice: `extractAttachmentIds` already matches the custom tag's `data-attachment-id` (so GC works unchanged), and no new `bodyHasExcalidraw` is added because nothing gates on it.

### 9. i18n - `public/locales/{en,cs}/translation.json`

Add `editor.excalidraw.tooltip`, `editor.excalidraw.delete`, `editor.excalidraw.unavailable` to both locales.
Creation errors reuse the existing `editor.image.errors.${code}` toast strings via `onError` (shared across all kinds today).

## Data flow

1. User clicks the drawing button -> `deps.getNoteId()` persists the draft -> `deps.createAttachment(noteId, sceneToFile(emptyScene()), 'excalidraw')` writes a row (`kind: 'excalidraw'`, `application/json` blob) -> `insertExcalidrawAttachment({ attachmentId })` inserts the node. The document JSON stores only `<excalidraw-drawing data-attachment-id>` - never the scene.
2. `ExcalidrawNodeView` (editable) loads the row via `useExcalidrawScene`, mounts the canvas with the scene, and on each edit debounces a **write-back**: `updateAttachment(attachmentId, { blob: sceneToFile(scene), preview: await sceneToSvgString(scene) })`. Scene edits persist **directly to the attachment row**, decoupled from body autosave (the body's `attachmentId` never changes, so an edit does not dirty the body - persistence is guaranteed by the direct row update).
3. On the home card, `NoteBody` fetches the row and injects `attachment.preview` inline; the canvas is never mounted on the feed (performance).
4. Cross-note copy/paste: `dedupeForeignAttachments` clones the row (blob **and** `preview`, via the existing spread in `cloneAttachment`) into an owned copy - unchanged.
5. Delete / GC: removing the node leaves the row unreferenced; `collectOrphans` (keyed on `extractAttachmentIds`) reaps it - unchanged.

## Error handling

- Malformed / missing scene JSON -> `parseScene` returns `null` -> NodeView "unavailable" box with a delete button.
- Creation failure (quota, etc.) -> `AttachmentError` or generic -> `deps.onError(code)` -> existing translated toast.
- Write-back failure -> logged; the in-memory canvas keeps the user's edits, and the next successful debounced write recovers. A failed snapshot render (`exportToSvg` throws) is caught so the scene blob is still saved even if the `preview` could not be regenerated (the card falls back to blank rather than losing the drawing).
- Oversized scene (> `MAX_EXCALIDRAW_BYTES`) on write-back -> `updateAttachment` is best-effort and does not re-validate; the 25 MB cap is enforced only at creation. (A scene that grows past the cap through editing is not truncated - noted as an accepted limitation.)

## Testing (same change, pragmatic TDD)

- **`lib/attachments.test.ts`**: `validateAttachmentFile(file, 'excalidraw')` - accepts `application/json` under the cap, rejects a non-JSON type, rejects oversize.
- **`hooks/data/useAttachmentActions.test.ts`**: `updateAttachment` replaces the blob and sets `preview` + `updatedAt` (`// @vitest-environment node` for the Blob round-trip - see the jsdom/fake-indexeddb Blob gotcha).
- **`extensions/Excalidraw/scene.test.ts`**: `emptyScene`/`sceneToFile`/`parseScene` round-trip; `parseScene` returns `null` on malformed input. (`sceneToSvgString` is exercised via the NodeView test with a mocked `exportToSvg`.)
- **`extensions/Excalidraw/useExcalidrawScene.test.tsx`**: ready / missing / malformed states.
- **`extensions/Excalidraw/ExcalidrawNodeView.test.tsx`** (Excalidraw + `exportToSvg` mocked): loads the scene into the canvas; an `onChange` triggers a debounced `updateAttachment` with blob + preview; missing state renders the unavailable box.
- **`extensions/Excalidraw/Excalidraw.test.ts`** (headless, `Bold.test.ts` template): parse/render round-trip of `<excalidraw-drawing data-attachment-id>` (no payload), `insertExcalidrawAttachment` inserts the node, button factory returns the expected `component`/`componentProps`.
- **`menus/toolbars/BlocksSection.test.tsx`**: the drawing button surfaces (`editor.excalidraw.tooltip`).
- **`NoteBody.test.tsx`**: an `excalidraw-drawing[data-attachment-id]` node gets its resolved `preview` SVG injected (image-like), and is **not** stripped.

## Assumptions

- **`@excalidraw/excalidraw` is acceptable as a heavy runtime dependency.** It is the canonical drawing engine and the whole point of the slice; it is lazy-relevant (imported only by the editor path, not the card). If bundle size becomes a concern, dynamic-importing the canvas is a follow-up, not this slice.
- **25 MB scene cap** (`MAX_EXCALIDRAW_BYTES`), enforced at creation only; trivially adjustable.
- **Delete uses the shared `ConfirmDeleteButton` from Slice 3.5** (`src/components/editor/extensions/attachments/ConfirmDeleteButton.tsx`), matching Image/Audio/Video/File: the trash-icon trigger opens a confirm dialog and `onConfirm` calls `props.deleteNode()` (editor-only; blob GC still happens later via `collectOrphans` at dialog close). Slice 5 depends on Slice 3.5 having landed.
- **SVG snapshot is stored, not regenerated per render** (approved: the user wants a home-card preview without the cost of re-mounting the canvas on every feed render).
- **Scene write-back is decoupled from body autosave** and persists directly to the attachment row; editing a drawing does not mark the note body dirty.
- **No Dexie migration** is needed for `preview` (non-indexed property).

---

# Rework v2 - Modal editing surface (supersedes the inline-canvas design)

## Why this rework

The v1 design (above) mounts the **live `@excalidraw/excalidraw` canvas inline inside the ProseMirror NodeView**.
In practice this does not work.
Two independent causes:

1. **Missing stylesheet (hard bug).**
   `@excalidraw/excalidraw`'s CSS (`@excalidraw/excalidraw/index.css`, confirmed present in v0.18.1's package `exports`) is never imported anywhere in the app.
   Without it the canvas renders as an unstyled, collapsed, non-functional element regardless of where it is mounted.
   The official import example a user would copy includes this CSS import; we dropped it.
2. **Inline-in-contentEditable (architectural).**
   Embedding a live, pointer- and keyboard-hungry canvas editor inside a `contentEditable` ProseMirror document fights the host on focus, pointer capture, selection, sizing, and undo-stack ownership.
   Even with the CSS fixed this is a fragile arrangement.

**Decision:** keep the entire attachment/node/storage design from v1, but move the *editing surface* out of the document into a **modal dialog**, leaving only a **static preview node** in the document.
This is the arrangement Excalidraw itself recommends and is more robust and maintainable.

This section **supersedes** v1 sections **5 (NodeView)** and **6 (Toolbar button)**, and revises the **Data flow**.
Everything else in v1 stands unchanged: the `excalidrawAttachment` node on the unchanged `createAttachmentNode` factory, the `<excalidraw-drawing data-attachment-id>` serialization, `scene.ts`, `updateAttachment`, the `Attachment.preview` field, `kind: 'excalidraw'` + validation, GC/dedupe, and the home-card SVG injection in `NoteBody` (§8).

## Decisions (agreed in grilling)

1. **Commit-on-Save.**
   Clicking the toolbar button opens an *empty* modal.
   Nothing touches Dexie or the document until the user hits **Save**.
   Cancel creates no attachment row and no node.
   (This removes v1's eager "create empty attachment + insert node on button click" model.)
2. **One shared modal**, owned by `editor.tsx`, opened via a new `deps.openExcalidraw({ attachmentId?, onDelete? })` callback threaded through `AttachmentDeps`.
   Exactly one `<Excalidraw>` instance is mounted at a time, and only while the modal is open.
   Each drawing remains its own attachment / scene / preview (many drawings per note); the modal edits one drawing at a time.
3. **Guarded explicit actions** in the modal - no accidental dismissal:
   - **Save** - commits (create-or-update). **Disabled when the scene has zero elements** (never deletes).
   - **Cancel / X** - discard and close. When the scene is *dirty* (Excalidraw's `onChange` has fired since open), show a "Discard drawing?" confirm first; otherwise close silently.
   - **Delete** - **edit-mode only** (an existing drawing). Confirm-guarded; removes the node + row.
   - Backdrop click and Escape do **not** dismiss (`onPointerDownOutside` / `onEscapeKeyDown` -> `preventDefault`); the dialog's built-in close-X is disabled (`showCloseButton={false}`) and replaced by our own X that runs the same dirty-guarded Cancel handler.
   - The three verbs stay distinct: Save never deletes, Delete never saves, Cancel never persists.
4. **Preview node is passive + interactive.**
   The editable NodeView renders the **stored SVG preview** (no live canvas).
   The **whole surface is tap-to-edit** (`openExcalidraw({ attachmentId, onDelete })`).
   A **delete X is always visible top-right** (shared `ConfirmDeleteButton`), with `stopPropagation` so deleting never also opens the editor.
   The read-only home-card path (`NoteBody`, §8) is unchanged.
5. **Live-query preview.**
   Because a drawing's blob/preview change on every re-edit (unlike immutable image/audio/video), the preview node reads the attachment row via Dexie `useLiveQuery`.
   A modal Save reactively refreshes the in-editor preview with **zero body churn** (the node's `attachmentId` never changes).
6. **Scene read on Save via `excalidrawAPI` ref** (`getSceneElements` / `getAppState` / `getFiles`) rather than mirroring every `onChange` into React state.
   `onChange` is used only as a cheap dirty flag.
7. **Modal delete reuses existing node-removal.**
   The preview node passes `onDelete: () => props.deleteNode()` through the open call; both the preview's corner-X and the modal's Delete button funnel through the identical `props.deleteNode()` -> orphan-GC path.
   No new data-layer deletion primitive.
8. **Sizing - relative units only (no px, including max/min).**
   Mobile-first true fullscreen (`w-screen h-[100dvh] max-w-none rounded-none`); `sm:` and up a large centered surface (`sm:w-[92vw] sm:max-w-[75rem] sm:h-[88vh] sm:rounded-lg`), `p-0`, laid out as a flex column: a slim header row holding the actions (**top-right**) and the canvas filling the rest (`flex-1 min-h-0`).
   Actions are top-right (not a bottom footer) **only** because Excalidraw owns the bottom edge with its own mobile toolbar - a real collision overriding the normal bottom-of-modal convention.

## Component shape

- **`ExcalidrawDialog`** (new, presentational + self-contained editing state) - `src/components/editor/extensions/Excalidraw/ExcalidrawDialog.tsx`.
  Imports `@excalidraw/excalidraw/index.css` (the CSS fix).
  Props (controlled by `editor.tsx`): `{ open: boolean; mode: 'new' | 'edit'; initialScene: ExcalidrawScene | null; onSave: (scene: ExcalidrawScene) => Promise<void> | void; onDelete?: () => void; onClose: () => void }`.
  Holds the `excalidrawAPI` ref, the dirty flag, and the empty/disabled-Save logic; renders the guarded Save / Cancel / Delete controls and the discard-confirm.
  The dialog is `key`ed by the drawing identity (attachmentId or a "new" sentinel) so it resets cleanly between opens.
- **`editor.tsx`** owns modal state `{ open, mode, attachmentId | null, initialScene, onDelete }` and renders one `<ExcalidrawDialog>`.
  It implements `onSave`:
  - **new** (no attachmentId): `noteId = await getNoteId()` -> `att = await createAttachment(noteId, sceneToFile(scene), 'excalidraw')` (with `preview` via `sceneToSvgString`) -> `editor.chain().focus().insertExcalidrawAttachment({ attachmentId: att.id }).run()`.
  - **edit** (has attachmentId): `await updateAttachment(attachmentId, { blob: sceneToFile(scene), preview: await sceneToSvgString(scene) })` -> live-query refreshes the preview.
  `openExcalidraw` reads the current scene (one-shot, via `getAttachment` + `parseScene`) to seed `initialScene` for edit; `new` seeds `emptyScene()`.
- **`AttachmentDeps`** gains `openExcalidraw: (args: { attachmentId?: string; onDelete?: () => void }) => void`.
- **`ExcalidrawNodeView`** (rewritten) - preview-only.
  Live-queries the attachment row (for `.preview`); renders the SVG in a tap-to-edit surface (`onClick` -> `deps.openExcalidraw({ attachmentId, onDelete: () => props.deleteNode() })`), the always-visible corner-X (`ConfirmDeleteButton`, `stopPropagation`), and the missing/loading states.
  No `<Excalidraw>` import, no debounced write-back.
- **`ExcalidrawButton`** (rewritten) - `action: () => deps.openExcalidraw({})` (open empty modal; no create, no insert).

## Revised data flow

1. **New drawing:** button -> `openExcalidraw({})` -> modal opens on `emptyScene()`.
   User draws.
   **Save** -> `getNoteId()` -> `createAttachment(sceneToFile(scene), 'excalidraw')` (+ `preview`) -> `insertExcalidrawAttachment({ attachmentId })` (this node insertion is the only body change).
   Cancel -> nothing persisted.
2. **Edit drawing:** tap the preview -> `openExcalidraw({ attachmentId, onDelete })` -> modal opens on the parsed stored scene.
   **Save** -> `updateAttachment(attachmentId, { blob, preview })` -> live-query re-renders the preview in place (no body change).
3. **Delete:** preview corner-X *or* modal Delete -> `props.deleteNode()` -> row unreferenced -> `collectOrphans` reaps it at `NoteEditorDialog` close (unchanged).
4. **Home card:** `NoteBody` injects the stored `preview` SVG (unchanged from v1 §8).

## What is removed vs v1

- The inline `<Excalidraw>` mount in the NodeView and its 800ms debounced write-back / unmount-flush.
- Eager attachment creation + node insertion on toolbar-button click (moved to Save).
- The read-only branch of the NodeView is no longer the only SVG path - the *editable* NodeView is now also SVG-based (the canvas lives solely in the modal).

## What is kept from v1 (unchanged)

`scene.ts` (all helpers), `updateAttachment`, `Attachment.preview`, `kind: 'excalidraw'` + validation, the `excalidrawAttachment` node + factory reuse + `<excalidraw-drawing>` tag + `BlocksSection` registration, `EXCALIDRAW_ASSET_PATH`, `NoteBody` SVG injection (§8), GC/dedupe.

## Testing delta

- **`ExcalidrawDialog.test.tsx`** (Excalidraw + `exportToSvg` mocked): Save disabled on empty scene; drawing enables Save; Save emits the scene to `onSave`; Cancel with a dirty scene shows the discard-confirm; Delete (edit mode) calls `onDelete`; Escape/backdrop do not close.
- **`ExcalidrawNodeView.test.tsx`** (rewritten): renders the live-queried preview SVG; tapping the surface calls `openExcalidraw({ attachmentId, onDelete })`; the corner-X confirm calls `deleteNode` and does **not** open the editor (`stopPropagation`); missing state.
- **`ExcalidrawButton.test.tsx`** (rewritten): click calls `openExcalidraw({})` - no `createAttachment`, no insert.
- **`editor` integration**: `onSave` for a new drawing creates the attachment + inserts the node; for an edit calls `updateAttachment`.
- Unchanged: `scene.test.ts`, `attachments.test.ts` (validation), `useAttachmentActions.test.ts` (`updateAttachment`), `NoteBody.test.tsx`, `BlocksSection.test.tsx` (button surfaces).

## New assumptions

- **Nested dialogs** (note-editor dialog -> Excalidraw modal -> confirm dialog) are acceptable; Radix supports the depth.
- **`@excalidraw/excalidraw/index.css` imported once** in `ExcalidrawDialog` (the only place the canvas mounts).
- **Dirty detection = "onChange fired since open"** (cheap over-approximation); acceptable that Excalidraw may fire an initial onChange - if it proves to over-report dirtiness, compare element count/version instead.
