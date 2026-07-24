# M3 Slice 4 - Generic file attachments

## Context

M3 adds attachments and rich media.
Slice 1 shipped inline images and the storage foundation (generic `attachments` Dexie table, `useAttachmentActions`, cascade delete/undo, orphan GC).
Slice 2 shipped inline audio and, in the process, extracted a **media-agnostic core** under `src/components/editor/extensions/attachments/` (`createAttachmentNode`, `useAttachmentObjectUrl`, `insert.ts`, `deps.ts`).
Slice 3 shipped inline video on top of that core, file-for-file mirroring audio.
The editor's own `CLAUDE.md` already states the intent: "a future Video/File node should extend [the core] the same way rather than duplicating node/insertion logic."

Slice 4 adds a **generic file attachment** on top of that core.
It is one `fileAttachment` node covering PDFs and any other file type - not a per-MIME node (the user's framing was "files like pdf and such", i.e. a single generic kind).
It mirrors video's shape almost exactly, with the differences driven by files being **not inline-renderable**: instead of a native player, the NodeView shows the original filename, a generic file icon, and an open/download affordance.

## Scope

**In scope**

- A custom `fileAttachment` TipTap node (atom, block, draggable) carrying only `attachmentId` (no persisted `src`/`href`), built on `createAttachmentNode`.
- File attachment via a toolbar picker (any file type), through the shared `insertAttachmentFiles` pipeline.
- An in-editor NodeView showing a generic file icon, the original filename (`Attachment.name`), and an open/download affordance (opens the Blob via object URL in a new tab; non-viewable types download), with the same delete affordance as video.
- A home-card **file-button affordance** (a generic file icon, no preview), mirroring the audio/video buttons, laid out in the same flex row so audio, video, and file buttons coexist without overlapping.
- Validation for `kind: 'file'`: **no MIME whitelist** (accepts broadly), **size cap only**.
- Tests landing in the same change (pragmatic TDD).

**Explicitly out of scope (deferred)**

- Content preview / thumbnail generation of any kind - no PDF-page thumbnail, no per-file-type icon. The card and NodeView show one generic file icon only. PDF thumbnailing is deferred indefinitely, not to a later sub-slice of this plan (explicit performance/scope decision).
- Paste and drag-and-drop of arbitrary documents. Unlike image/audio/video, a generic file has **no MIME prefix** to disambiguate it from those media kinds in the shared paste/drop router, so a naive catch-all branch would fight the existing media routing. This slice attaches files via the toolbar picker only; document paste/drop is deferred (see Assumptions).
- Metadata extraction beyond the filename already stored on `Attachment.name`.

## Design

### 1. Model - `models.ts` (no change)

`AttachmentKind` already includes `'file'` (`'image' | 'audio' | 'video' | 'file'`), and the `attachments` Dexie table is kind-agnostic per Slice 1.
No schema change, no migration.
`Attachment.name` (already present) carries the original filename that the NodeView and card display.

### 2. Validation - `lib/attachments.ts`

Add a size cap and a `file` branch to `validateAttachmentFile`:

```ts
/** Per-file size cap: 50 MB. Generous relative to media caps because a file
 *  attachment can be any document (PDFs, archives, ...). Adjustable. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
```

Replace the current `file`-kind fall-through (which returns `'unsupported-type'`) with:

```ts
if (kind === 'file') {
  // No MIME whitelist: a file attachment accepts any type. Only the size cap
  // gates it (unlike image/audio/video, which whitelist their MIME).
  if (file.size > MAX_FILE_BYTES) return 'too-large';
  return null;
}
```

The image/audio/video branches are unchanged.

### 3. Insert pipeline - `extensions/attachments/insert.ts`

`file` has no MIME prefix, so it cannot ride the `MIME_PREFIX` `startsWith` filter the media kinds use.
Give `file` a **match-all** path: every picked file is a candidate, and validation (size-only) decides acceptance.

Change the `matched` computation in `insertAttachmentFiles`:

```ts
const matched =
  kind === 'file'
    ? Array.from(files) // file accepts any type; the size cap gates it
    : prefix
      ? Array.from(files).filter((f) => f.type.startsWith(prefix))
      : [];
if (matched.length === 0) return;
```

`MIME_PREFIX` keeps `image`/`audio`/`video` and does **not** gain a `file` entry (there is no single prefix for it).
Because only the toolbar picker calls the pipeline with `kind: 'file'` (paste/drop route media by prefix and have no file branch), match-all never double-consumes a media file.
`dedupeForeignAttachments`, clone, and GC already key off `data-attachment-id` and need no change.

### 4. Node - `extensions/File/File.ts` (new)

`createFile(getDeps)` calls `createAttachmentNode(getDeps, config)`, exactly like `createVideo`:

- `name: 'fileAttachment'`
- `parseTag: 'a[data-attachment-id]'`, `renderTag: 'a'` (a file attachment is semantically a link to a downloadable resource; per ADR 0007 the serialized `<a>` carries **no `href`** - the object URL is resolved at render time, never persisted).
- `insertCommandName: 'insertFileAttachment'`
- `nodeView: FileNodeView`
- `button`: `{ component: FileButton, componentProps: { editor, getDeps, tooltip: t('editor.file.tooltip') } }`

The `Commands` module augmentation declares `fileAttachment.insertFileAttachment`.
`extensions/File/index.ts` re-exports `createFile`.

### 5. NodeView - `extensions/File/FileNodeView.tsx`

Files are not inline-renderable, so instead of a media element the NodeView renders a **row**: a generic file icon, the filename, and an open/download affordance.

- Wrapper: `NodeViewWrapper as="div" className="my-2" data-drag-handle`.
- Resolves the object URL and name via the shared `useAttachmentObjectUrl(attachmentId, deps.getAttachment)` hook.
- **Ready state**: a bordered row (`flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2`) containing:
  - the generic file icon (`FileText`),
  - the filename (`state.name`, falling back to `deps.t('editor.file.fallbackName')`), truncated,
  - an **open/download affordance**: `<a href={state.url} download={state.name ?? ''} target="_blank" rel="noopener noreferrer" aria-label={deps.t('editor.file.open')}>` styled as a button, with a `Download` icon. Clicking opens the Blob in a new tab; the browser downloads types it cannot display inline.
- **Delete button**: shown only when `props.editor?.isEditable`, built from Slice 3.5's shared `ConfirmDeleteButton` (`../attachments/ConfirmDeleteButton`) - the confirm dialog wraps the trash-icon trigger, so a misclick asks before removing. Constructed exactly like Video's NodeView after Slice 3.5: `<ConfirmDeleteButton onConfirm={() => props.deleteNode()} label={deps.t('editor.file.delete')} t={deps.t} />`. `onConfirm` still just calls `props.deleteNode()` (editor-only; blob GC stays at dialog close). The `editor.file.delete` string is the trigger's `aria-label`; the shared `attachments.confirmDelete.*` strings (from Slice 3.5) supply the dialog copy.
- **Missing state**: the same "unavailable" dashed box as video when `state.status === 'missing'`, using `deps.t('editor.file.unavailable')`, with the same `ConfirmDeleteButton`.

### 6. Toolbar button - `extensions/File/FileButton.tsx`

A copy of `VideoButton`:

- Renders an `ActionButton` (icon `Paperclip`, already in the registry) plus a hidden `<input type="file" multiple>`.
- **No `accept` attribute** - the file button accepts any type (the picker is explicit user intent), and an unrestricted picker also sidesteps the Chrome-on-Linux greying-out that a specific `accept` triggers.
- On change, resolves deps at click time and runs `insertAttachmentFiles(editor, files, 'file', getDeps(), (id) => editor.chain().focus().insertFileAttachment({ attachmentId: id }).run())`, then clears `e.target.value` to allow re-picking the same file.

### 7. Icons - `src/components/icons/icons.ts`

The toolbar button reuses the already-registered `Paperclip`.
Add `FileText` (generic file icon, used by the NodeView and the card button) and `Download` (the NodeView open affordance) to the `lucide-react` import and the `icons` object.

### 8. Editor wiring - `editor.tsx`, `menus/toolbars/BlocksSection.tsx`

- Register `createFile(getAttachmentDeps)` in the extensions array (after `createVideo`).
- Add `'fileAttachment'` to `BLOCK_EXTENSION_NAMES` in `BlocksSection.tsx` (registering the node is not enough - the toolbar bar renders only the names it is given).
- **No** `handlePaste`/`handleDrop` branch for files this slice (see out-of-scope).

### 9. Home card - `lib/attachment-html.ts`, `NoteBody.tsx`, `cards/NoteCard.tsx`

- **`attachment-html.ts`**: add `bodyHasFile(html)` using a non-global `/<a\b[^>]*\bdata-attachment-id="[^"]+"/i` regex, mirroring `bodyHasVideo`.
- **`NoteBody.tsx`**: strip src-less `<a data-attachment-id>` nodes (same reasoning as audio/video - the card shows a button, not the raw node).
- **`cards/NoteCard.tsx`**: add `const hasFile = bodyHasFile(note.body)` and gate the pinned control row on `hasAudio || hasVideo || hasFile`. Add a third button to the existing `flex gap-2` row (after the video button): the `FileText` icon, `aria-label={t('notes.openFile')}`, `onClick` opens the note via `onSelect(note.id)` (no autoplay intent - a file has nothing to play).

### 10. i18n - `public/locales/{en,cs}/translation.json`

Add under `editor` a new `file` object: `tooltip`, `delete`, `unavailable`, `open`, `fallbackName`.
Add `notes.openFile` to both locales.

## Data flow

1. User clicks the toolbar file button and picks one or more files -> `insertAttachmentFiles(files, 'file', deps, insertNode)`.
2. The pipeline takes **all** picked files (no MIME filter), calls `deps.getNoteId()` once, then `deps.createAttachment(noteId, file, 'file')` per file (validation runs inside `createAttachment` via `validateAttachmentFile`, size-cap only).
3. On success, `insertFileAttachment({ attachmentId })` inserts the node; the bytes live in the `attachments` row (`kind: 'file'`), never in the document JSON. The body persists `<a data-attachment-id>` with no `href`.
4. `FileNodeView` resolves `attachmentId` -> Blob object URL + name for the icon/filename/open-link; the URL is revoked on unmount/id change by the shared hook.
5. On the home card, `bodyHasFile` gates a pinned file button that opens the note.

## Error handling

- Oversize (over `MAX_FILE_BYTES`) -> `AttachmentError('too-large')` -> `deps.onError('too-large')` -> existing translated toast. (There is no `unsupported-type` path for files - any type is accepted.)
- Missing/deleted blob -> NodeView "unavailable" box with a delete button.
- Cross-note copy/paste of a foreign file node -> existing `dedupeForeignAttachments` clones the row into an owned copy (no new code).

## Testing (same change, pragmatic TDD)

- **`lib/attachments.test.ts`**: `validateAttachmentFile(file, 'file')` accepts an arbitrary type (e.g. `application/pdf`, `application/zip`) under the cap, rejects oversize (`> MAX_FILE_BYTES`), and accepts exactly the cap.
- **`extensions/File/File.test.ts`** (headless, `Video.test.ts` template): parse/render round-trip of `<a data-attachment-id>` with no `href`, `insertFileAttachment` inserts the node, button factory returns the expected `component`/`componentProps` (`tooltip === 'editor.file.tooltip'`).
- **`extensions/File/FileNodeView.test.tsx`**: renders the filename and an open link whose `href` is the resolved object URL; delete button shown only when editable; `missing` state renders the unavailable box.
- **`lib/attachment-html.test.ts`**: `bodyHasFile` true/false cases (true for `<a data-attachment-id>`, false for plain `<a href>` without the marker).
- **`cards/NoteCard.test.tsx`**: file button present for a file-only body; audio, video, and file buttons coexist for a note with all three.

## Assumptions

- **50 MB** per-file cap (`MAX_FILE_BYTES`) - a generous default for IndexedDB-stored blobs; **confirm this value**.
- **No MIME whitelist** for `file` (any type accepted) - a deliberate decision per the user; only the size cap gates it.
- **File attach is toolbar-picker only** this slice (confirmed with user 2026-07-23); drag-and-drop / paste of arbitrary documents is deferred because `file` has no MIME prefix to disambiguate from media in the shared paste/drop router. If document drop/paste is picked up in a later slice, it becomes a catch-all branch that runs *after* the image/audio/video branches (matching only files not claimed by those prefixes).
- **No content preview / thumbnail** - the card and NodeView show a single generic file icon; PDF thumbnailing is deferred indefinitely (performance/scope decision).
- **Delete button** uses Slice 3.5's shared `ConfirmDeleteButton` (`extensions/attachments/ConfirmDeleteButton.tsx`), which has landed. File's NodeView wires it exactly as Video/Audio/Image do after Slice 3.5: `<ConfirmDeleteButton onConfirm={() => props.deleteNode()} label={deps.t('editor.file.delete')} t={deps.t} />`, guarded by `props.editor?.isEditable`. The dialog copy comes from the shared `attachments.confirmDelete.*` strings; only the per-kind `editor.file.delete` aria-label is new to this slice. File's implementation therefore **depends on Slice 3.5 having landed**.
- **`<a>` as the file node's tag** is a semantic choice (a downloadable link); it is distinctive enough for the `bodyHasFile` regex and is stripped from the read-only card body like audio/video. No `href` is ever serialized (ADR 0007).
