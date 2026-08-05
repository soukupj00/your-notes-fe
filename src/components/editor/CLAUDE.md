# CLAUDE.md — `src/components/editor` (TipTap editor)

How the rich-text editor is built. The canonical extension/toolbar pattern is fixed by [ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md). See [`PLAN.md`](./PLAN.md) for the M1 work that brings the code in line with it.

## Structure

- `editor.tsx` — the `Editor` React component: `useEditor({ extensions, content, editable, onUpdate })`, renders `EditorContent`. Syncs external `content` prop into the editor via `setContent`.
- `extensions/<Name>/` — one folder per editing capability. Each has `<Name>.ts` (the extension) and `index.ts` (re-export).
- `toolbar/` — the customisable toolbar (ADR 0011).
  `registry.ts` maps a stable Toolbar Item id to its icon, **name** and family, and to the extension whose Pattern A `button` it renders; `presets.ts` holds the Minimal / Balanced / Everything stamps per Width Class; `resolveLayout.ts` reconciles a stored Layout against the registry and turns it into a render list; `EditorToolbar.tsx` draws it; `useWidthClass.ts` picks which of the two Layouts is in effect.
  `ToolbarLayoutEditor.tsx` is the one settings surface for a Layout, mounted twice: in `/settings`, and in a sheet over the editor dialog opened by the `customize` (`⚙`) Item (`ToolbarCustomizeButton.tsx`). The in-editor path must not navigate - the dialog may hold an unsaved draft. `layoutEdits.ts` holds the pure reorder/toggle primitives, `foldMarker.ts` the 360px capacity arithmetic, `ToolbarPreviewStrip.tsx` the static picture Settings uses because it has no live editor.
  `customize` is the one Item with no extension behind it, which is why the bar's "can I draw this?" filter is `canRenderItem` rather than `resolveItemButton`.
  The registry also carries each Item's `shortcut`, a deliberate copy of the extension's own `shortcutKeys` so `settings/ShortcutsSection.tsx` can list them without a live editor to resolve buttons against (the `ToolbarPreviewStrip` reason). `shortcuts.test.ts` pins the copy to the real button in both directions, so a new binding has to be added in both places or the suite fails.
  Reordering is `@dnd-kit/sortable` through the shared `ui/SortableList.tsx` (drag handle is the only drag origin, keyboard sensor on); the same rows serve the quick-capture list in `settings/QuickCaptureSection.tsx`.
  **The registry is also the slash menu's id space** (ADR 0011, decision 13): `SlashMenu/slashItems.ts` keys by Toolbar Item id and keeps only `keywords` and `run`, taking icon and name from the registry so the two surfaces cannot drift.
  The old `menus/` folder is gone: `ExtensionButtonBar.tsx` and the five `toolbars/*Section.tsx` files were a hardcoded bar by extension name, which the registry replaces.
  The legacy `ToolbarSection.tsx` and `ToolbarButton.tsx` had already been removed; the `extensions/text-color/` folder has also been removed (see Color note below).
- `extensions/build.ts` — every extension the editor mounts, in one function, so the registry's tests can resolve ids against the real mounted set rather than a copy that drifts.
- Shared button: `ActionButton` (`src/components/ui/ActionButton.tsx`); icon registry: `src/components/icons/icons.ts`.
  `ActionButton` owns three things worth knowing before adding a button. **A menu row's name comes from `MenuRowLabelProvider`, not a prop** - `ToolbarLeaf` states it once and whichever `ActionButton` ends up being the row picks it up, because half the leaves (`link`, the five attachment pickers, the two colour triggers) are custom components that *wrap* an `ActionButton` and could never be handed a label. **The keyboard shortcut is desktop-only** (`useFinePointer`, `(pointer: fine)` - the inverse of the 44px Touch Rule's signal) and lives only in the tooltip, never on a menu row. **Active styling is a class, not just `data-[state=on]`**, because a `PopoverTrigger asChild` overwrites `data-state` with its own `open`/`closed`.

## Canonical pattern (Pattern A — target state)

Each extension extends its upstream TipTap extension and attaches a `button` option:

```ts
export const Bold = TiptapBold.extend<BoldOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.commands.toggleBold(),
          isActive: () => editor.isActive('bold'),
          icon: 'Bold',                       // string key into icons.ts
          shortcutKeys: ['Mod', 'B'],
          tooltip: t('editor.bold.tooltip'),  // i18n
        },
      }),
    };
  },
});
```

- `icon` is a **string key** resolved by `ActionButton` through `src/components/icons/icons.ts` — never import a Lucide component into an extension's button config.
- A `button` may return an **array** of buttons (see `extensions/history/History.ts`, which yields undo + redo).
- Tooltips/labels go through i18n `t(...)`.

## Current state (mismatch to fix in M1)

Pattern A is partly adopted:

- **Wrapped extensions following Pattern A, each with a headless test:** `Bold`, `Italic`, `Strike`, `Underline`, `Clear` (clear formatting), `BulletList`, `OrderedList`, `TaskList`, `Heading` (H1-H3 buttons, see below), `Blockquote` (markdown `>` showcase), `Mathematics` (LaTeX, see below), `Color`/`Highlight`/`FontFamily`/`FontSize` (text styling, see below), plus `history`. `extensions/build.ts` registers all of them, `history` included. `Clear` is not a mark - it is an `Extension.create` whose button runs `clearNodes().unsetAllMarks()`. `ListItem` is wrapped only as a local re-export (structural child, no button); `TaskList` needs `TaskItem` (registered upstream in `editor.tsx`).
- **Content styling** comes from **`@tailwindcss/typography`**: the editor content has `prose prose-sm max-w-none` and the plugin is enabled with `@plugin "@tailwindcss/typography"` in `globals.css`. Prose's palette is mapped to the app theme tokens (`--tw-prose-*: var(--foreground)` etc. under `.prose`) so it matches light/dark automatically - so the editor uses plain `prose`, **not** `dark:prose-invert`. The only hand-written content CSS is the TipTap task-list override (`.tiptap ul[data-type="taskList"]`, via `@apply`) to put the checkbox and text on one line (including `li > div p { @apply my-0 }` to cancel prose's paragraph margins so the checkbox stays on the text's first line). Tailwind v4's `dark:` variant is bound to the app's `.dark` class via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css` (v4 otherwise defaults to `prefers-color-scheme`), so `dark:*` utilities follow the theme toggle. Toolbar toggle buttons carry `text-foreground` in the `toggleVariants` base so their icons adapt to the theme (only the active ones get `text-accent-foreground`).
- **Heading** contributes a **button array** (one toggle per level H1-H3), which the registry addresses as the three leaves `h1`/`h2`/`h3` of the `style` family (`buttonIndex` picks which). `undoRedo` and `textAlign` work the same way.
- **Responsive toolbar buttons are gone, replaced by two Layouts.** `hideOnMobile` (a developer-owned second toolbar that hid twelve leaves below `sm`) has been deleted from `button-types.ts` and every extension that set it. Which buttons a width shows is now stored user data: one Layout per **Width Class** (`compact` / `wide`), resolved through `resolveLayout`. Compact is a single non-wrapping row that scrolls horizontally - it sits above the virtual keyboard, so it may not take vertical space from the note; wide wraps.
  Compact is also `justify-between`, so a bar that fits spreads across its width; that is self-cancelling on a bar that overflows, since there is no free space to distribute. The first family is pinned (sticky) **only while the row scrolls** - the wrapper makes its family one flex item, which `justify-between` would otherwise spread around instead of within - and the wrapper carries no padding, because a pin that cost width could latch itself on.
  The compact default is `↶ ↷ ¶▾ T▾ ≔▾ 📎▾`: undo and redo as real buttons (a phone has no Ctrl+Z, and `history` being first also makes it the pinned family), then four collapsed ones. That is six slots, which is what `COMPACT_FOLD_SLOTS` says a 360px phone fits - the number is 44px per button, because DESIGN.md's Touch Rule is what governs a coarse pointer, not the 36px mouse width. `colour`, `block`, `align`, `font` and the `⚙` are off there rather than collapsed; the `⚙` stays on in the wide default, and `/settings` reaches the same editor either way.
- **Mathematics** uses the bundled `@tiptap/extension-mathematics` (extension name `Mathematics`, adds `inlineMath` + `blockMath` nodes). Writing LaTeX: type `$$...$$` (inline) or `$$$...$$$` (block) input rules, or use the toolbar button which prompts for LaTeX and inserts inline math. Clicking a rendered math node prompts to edit it. Built via `createMathematics(getEditor, t)` in `extensions/build.ts` (the node `onClick` handlers need the live editor, reached through a ref). `updateInlineMath`/`updateBlockMath` are called with an explicit `pos` - without it they read the original cursor selection and no-op inside a chain.
- Still **upstream / stubs:** `Attachment`, `Selection` are empty/partial stubs and/or registered upstream in `editor.tsx`.
- **Image** is a custom `imageAttachment` node (atom, block, draggable), not the upstream `@tiptap/extension-image`. It carries a single `attachmentId` attribute and never persists a `src`/base64 - the actual bytes live in the Dexie `attachments` table (see `src/db/CLAUDE.md`), reached via `useAttachmentActions`. Built via `createImage(getDeps)` (same shape as `createMathematics`): the node's React NodeView resolves `attachmentId` to a `Blob` and derives an object URL for rendering (revoked on unmount/id change), so nothing base64-encodes into the document JSON. Insertion happens through paste, drag-and-drop, and the toolbar button, all routed through a shared insertion pipeline that validates the file and creates the attachment row before inserting the node.
- **Audio** is a custom `audioAttachment` node (`extensions/Audio/Audio.ts`), built on the same shared `createAttachmentNode` factory as Image.
  It serializes as body `<audio data-attachment-id>` with no `src`; the bytes live in the Dexie `attachments` table (`kind: 'audio'`, plus a `duration` field), reached via `useAttachmentActions`.
  `AudioNodeView` (`extensions/Audio/AudioNodeView.tsx`) renders a custom player UI - play/pause, scrubber, elapsed/duration - wired to a hidden native `<audio>` element whose `src` is an object URL from the shared `useAttachmentObjectUrl` hook (`extensions/attachments/useAttachmentObjectUrl.ts`), revoked on unmount/id change.
  Native media `play`, `pause`, and `ended` events are the source of truth for the custom player's playback state.
  One-shot autoplay is coordinated by `audioAutoplay.ts` through `requestAutoplay` and `registerReadyAudio`, keeping its pending request and ready-player registry outside React while covering either note/audio load ordering.
  Recording goes through `useAudioRecorder` (`extensions/Audio/useAudioRecorder.ts`), a state-machine hook around `MediaRecorder` (idle -> requesting-permission -> recording -> stopped, with error/cancel paths that release the mic), driven by the toolbar's `AudioRecordButton` (`extensions/Audio/AudioRecordButton.tsx`).
  `useAudioRecorder` pre-checks `navigator.permissions.query({name:'microphone'})` before touching `getUserMedia`: only `'denied'` is actionable up front (fail fast with the real reason instead of a silent no-op), while `'granted'`/`'prompt'`/an unanswerable query all fall through to the stream request - Firefox and Safari reject the descriptor entirely.
  **Auto-capture** (M4 Slice 2): `Editor` takes an `initialCapture` prop (`'audio' | 'drawing' | 'picture'`) so the quick-capture speed-dial can open a note straight into a medium.
  Drawing opens the shared Excalidraw dialog and picture clicks a hidden `accept="image/*"` input the editor renders only for that case; audio goes through `audioCapture.ts`, a pending-then-fire coordinator in `editor.storage.audioAttachment.capture` (same shape as `audioAutoplay`) because the recorder is owned by the toolbar button, which mounts independently of the editor.
  All three are best-effort and one-shot: the picture picker in particular needs the originating tap's user activation to still be live.
  `AudioRecordButton` is now record-only (M3 Slice 4): the toolbar file-picker affordance it used to offer was removed. Uploading an audio file (including `.mp3`) goes through the generic **File** extension's toolbar button instead, which accepts any file type; pasting/dropping an `audio/*` file still creates an audio attachment via the shared paste/drop router.
- **Video** is a custom `videoAttachment` node (`extensions/Video/Video.ts`), built on the same `createAttachmentNode` factory. It serializes as body `<video data-attachment-id>` with no `src`; `VideoNodeView` uses a native `<video controls playsInline>` (no custom player skin needed) at the resolved object URL. Insertion is paste/drag-and-drop/toolbar-picker, same pipeline as Image/Audio.
- **File** is a custom `fileAttachment` node (`extensions/File/File.ts`), built on the same `createAttachmentNode` factory (M3 Slice 4). It serializes as body `<a data-attachment-id>` with no `href` (a file is not inline-renderable). `FileNodeView` shows a generic file icon, the original filename (`Attachment.name`), and an open/download link at the resolved object URL. Validation (`validateAttachmentFile`, `kind: 'file'`) has no MIME whitelist - any file type is accepted, gated only by a 50 MB size cap (`MAX_FILE_BYTES`). Insertion is **toolbar-picker only**: `file` has no single MIME prefix to disambiguate it from image/audio/video in the shared paste/drop router (`MIME_PREFIX` in `extensions/attachments/insert.ts`), so `insertAttachmentFiles` gives `kind: 'file'` a match-all path instead of a prefix filter, and `editor.tsx`'s `handlePaste`/`handleDrop` have no file branch.
  All four media nodes (Image/Audio/Video/File) share the `attachments/` core (`createAttachmentNode`, `useAttachmentObjectUrl`, `insert.ts`, `deps.ts`), `AttachmentDeleteButton`, and the hidden-input workflow in `AttachmentFilePickerButton`.
  `AttachmentDeleteButton` binds the generic control in `src/components/ui/ConfirmDeleteButton.tsx` to the attachment confirmation copy and owns the shared overlay treatment used by visual NodeViews.
  This leaves one generic `ConfirmDeleteButton` while keeping attachment-specific presentation local to the attachment module.
- **Excalidraw** is a custom `excalidrawAttachment` node (`extensions/Excalidraw/Excalidraw.ts`), built on the same shared `createAttachmentNode` factory as Image/Audio/Video/File.
  It serializes as body `<excalidraw-drawing data-attachment-id>` with no payload; the scene itself is stored as an `application/json` blob in the Dexie `attachments` table (`kind: 'excalidraw'`), with a self-generated SVG snapshot cached in `Attachment.preview`.
  `ExcalidrawNodeView` is a passive, live-queried SVG preview with tap-to-edit and an overlaid confirm-before-delete control.
  One shared `ExcalidrawDialog`, owned by `editor.tsx` and opened through `AttachmentDeps.openExcalidraw`, contains the live canvas and imports Excalidraw's stylesheet.
  `NotesView` lazy-loads `NoteEditorDialog`, and the editor lazy-loads `ExcalidrawDialog` only when a drawing opens, so neither TipTap nor the drawing engine is part of the initial feed download.
  Persistence is commit-on-Save: a new drawing creates its attachment and inserts its node only after Save, while editing updates the existing blob and preview without changing the body.
  Cancel discards changes, Delete removes the node through orphan GC, and both actions reuse the shared `ConfirmDialog`.
  `scene.ts` holds JSON serialization helpers and removes transient collaboration state that cannot survive JSON serialization.
  `sceneToSvgString` dynamically imports `@excalidraw/excalidraw` because eagerly importing the package touches `canvas.getContext()` at module scope, which crashes under jsdom without the native `canvas` package.
  The dialog and exporter share Vite's cached Excalidraw chunk.
- **Text styling via `@tiptap/extension-text-style`.** Four Pattern A extensions ride on the `textStyle` mark (registered once as `TextStyle` in `editor.tsx`); each wraps an upstream helper from that single package and returns a **custom-component** button:
  - **Text color** (`extensions/Color/`, name `color`) and **Highlight** (`extensions/Highlight/`, name `backgroundColor`, wraps `BackgroundColor`) use thin Pattern A adapters over `extensions/EditorColorPickerButton.tsx`.
    The shared module owns selection capture, live preview, the `ColorPickerPanel` popover, and mark commits; its `text` and `highlight` variants select the icon, palette, preview CSS property, and TipTap commands.
    They are the two leaves of the `colour` family.
  - **FontFamily** (`extensions/FontFamily/`, name `fontFamily`) and **FontSize** (`extensions/FontSize/`, name `fontSize`) use thin Pattern A adapters over `extensions/EditorTextStyleSelect.tsx`.
    The shared shadcn `Select` module owns their options, focus-and-commit behavior, and the `__default__` sentinel that maps to the corresponding unset command because Radix `Select.Item` forbids an empty-string value.
    Both live in their own `FontSection`.
  - The legacy `menus/ToolbarButton.tsx` and the `extensions/text-color/` folder were removed; the `Color/` vs `text-color/` duplicate is resolved (kept `Color/`).
  - **Live color preview.** In the custom (react-colorful) picker, dragging only **previews** the color on the selected text and commits (a real `setColor`/`setBackgroundColor` mark) on pointer **release** - so a drag is one clean undo step, not one per mouse-move, and the popover never loses focus mid-drag. The preview is a ProseMirror inline decoration held by the `colorPreview` extension (`extensions/color-preview.ts`, registered in `editor.tsx`): the buttons capture the selection range on popover open, call `previewColor(editor, {from,to,style})` during the drag and `clearColorPreview(editor)` on release/close, and commit the mark to the stored range via `setTextSelection(...)` **without** `focus()` (so the popover stays open). `ColorPickerPanel` exposes an optional `onPreview` (drag) alongside `onChange` (commit); the card picker omits `onPreview` and keeps its immediate live behavior.
- All toolbar buttons are extension-owned `button` factories (Pattern A), resolved by id through `toolbar/registry.ts`. List buttons switch directly between bullet/ordered/task (no `can()` gating) and, via `extensions/list-toggle.ts` (`toggleWholeList`), convert the **whole** list when the cursor is collapsed inside one - not just the current item (needed because `taskList` uses a different item type than bullet/ordered). An explicit selection is respected as-is. Mark buttons (`Bold`/`Italic`/`Strike`/`Underline`/`Clear`/`Color`) and block buttons (`Heading` H1-H3, `Blockquote`, `Mathematics`) each set `toggle: true` so they render as toggle-styled toolbar buttons with an active highlight. Grouping on the bar is implicit in family order - there are no `Separator`s and no sections. The Mathematics (LaTeX) button uses a custom `Latex` icon (`src/components/icons/LatexIcon.tsx`, a "TeX" wordmark) registered in `icons.ts`.

- The `History/` empty variant and the duplicate `HistoryActionButton` implementation have been removed. The remaining `history/History.ts` (extension name `undoRedo`) uses the canonical `ActionButton` with typed `Undo2` and `Redo2` icon keys, and is now **registered** in the editor - before the registry work it was built but mounted nowhere, so a phone (no `Ctrl+Z`) had no way to undo at all.

## Testing extensions (Vitest)

Tests run **headless** — no DOM render needed. Build `new Editor({ extensions: [Document, Paragraph, Text, <Ext>] })` from `@tiptap/core`, then:

- drive `editor.commands.*` and assert `editor.getHTML()` / `editor.isActive(...)`;
- pull the button via `editor.extensionManager.extensions.find(e => e.name === '<name>').options.button({ editor, t })` and assert its `componentProps` (`icon`, `tooltip`, `shortcutKeys`) and that `action()` flips `isActive()`;
- trigger markdown input rules with `editor.view.someProp('handleTextInput', (f) => f(editor.view, from, from, ' '))`.

`extensions/Bold/Bold.test.ts` is the canonical template. Run `pnpm test`.

When editing here, follow Pattern A for new work and migrate the above — don't add more Pattern B arrays.
