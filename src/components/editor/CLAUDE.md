# CLAUDE.md — `src/components/editor` (TipTap editor)

How the rich-text editor is built. The canonical extension/toolbar pattern is fixed by [ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md). See [`PLAN.md`](./PLAN.md) for the M1 work that brings the code in line with it.

## Structure

- `editor.tsx` — the `Editor` React component: `useEditor({ extensions, content, editable, onUpdate })`, renders `EditorContent`. Syncs external `content` prop into the editor via `setContent`.
- `extensions/<Name>/` — one folder per editing capability. Each has `<Name>.ts` (the extension) and `index.ts` (re-export).
- `menus/` — `ExtensionButtonBar.tsx` (resolves + renders extension-owned Pattern A `button`s by name; the canonical way to compose a toolbar section — a factory may return one button or an array, e.g. Heading levels / undo+redo). `toolbars/FormatSection.tsx` and `toolbars/ListSection.tsx` are both migrated to Pattern A (thin wrappers over `ExtensionButtonBar`). The legacy `ToolbarSection.tsx` and `ToolbarButton.tsx` have been removed; the `extensions/text-color/` folder has also been removed (see Color note below).
- `ShortcutKey.tsx` — renders keyboard-shortcut hints (currently unused after the toolbar migration; kept for reuse).
- Shared button: `ActionButton` (`src/components/ui/ActionButton.tsx`); icon registry: `src/components/icons/icons.ts`.

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

- **Wrapped extensions following Pattern A, each with a headless test:** `Bold`, `Italic`, `Strike`, `Underline`, `Clear` (clear formatting), `BulletList`, `OrderedList`, `TaskList`, `Heading` (H1-H3 buttons, see below), `Blockquote` (markdown `>` showcase), `Mathematics` (LaTeX, see below), `Color`/`Highlight`/`FontFamily`/`FontSize` (text styling, see below), plus `history`. `editor.tsx` registers all of these wrapped versions (and imports `katex/dist/katex.min.css`). `Clear` is not a mark - it is an `Extension.create` whose button runs `clearNodes().unsetAllMarks()`. `ListItem` is wrapped only as a local re-export (structural child, no button); `TaskList` needs `TaskItem` (registered upstream in `editor.tsx`).
- **Content styling** comes from **`@tailwindcss/typography`**: the editor content has `prose prose-sm max-w-none` and the plugin is enabled with `@plugin "@tailwindcss/typography"` in `globals.css`. Prose's palette is mapped to the app theme tokens (`--tw-prose-*: var(--foreground)` etc. under `.prose`) so it matches light/dark automatically - so the editor uses plain `prose`, **not** `dark:prose-invert`. The only hand-written content CSS is the TipTap task-list override (`.tiptap ul[data-type="taskList"]`, via `@apply`) to put the checkbox and text on one line (including `li > div p { @apply my-0 }` to cancel prose's paragraph margins so the checkbox stays on the text's first line). Tailwind v4's `dark:` variant is bound to the app's `.dark` class via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css` (v4 otherwise defaults to `prefers-color-scheme`), so `dark:*` utilities follow the theme toggle. Toolbar toggle buttons carry `text-foreground` in the `toggleVariants` base so their icons adapt to the theme (only the active ones get `text-accent-foreground`).
- **Heading** contributes a **button array** (one toggle per level H1-H3); its section (`HeadingSection`) sits at the **start** of the toolbar. Mobile-first: H2/H3 set `hideOnMobile: true`, so only H1 shows below the `sm` breakpoint (see the responsive note below).
- **Responsive toolbar buttons.** Any Pattern A `button` view may set `hideOnMobile?: boolean` (on the `ButtonView`, alongside `component`/`componentProps` - see `extensions/button-types.ts`). `ExtensionButtonBar` wraps such buttons in a `<span class="hidden sm:inline-flex">`, so they are hidden below `sm` (640px) and shown on larger screens. Each `ExtensionButtonBar` wrapper is also `display: contents` **on mobile** (`contents ... sm:flex`), so below `sm` its buttons become direct children of the toolbar's `flex-wrap` container and wrap **button-by-button** (H1 flows next to the format buttons, etc.) instead of whole sections dropping to the next line at once; at `sm`+ each section is a normal grouped flex. It is applied generically at the bar level, so it works for **any** extension's buttons, including custom-component ones (color/highlight/fonts), not just `ActionButton`s. The current mobile-visible set is the **Balanced preset**: H1, Bold, Italic, Underline, Color, Highlight, and the three list buttons (Bullet/Ordered/Task) stay; **hidden below `sm`** are Heading H2/H3, Strike, Clear, Blockquote, Mathematics, FontFamily, and FontSize. The section `Separator`s are also `hidden sm:block` (in `editor.tsx`) so the mobile bar has no dividers and no dangling separators around the now-empty Blocks/Font sections - which also reclaims width to fit the visible buttons on one row on typical phones (it wraps the list group to a second row only if it overflows).
- **Mathematics** uses the bundled `@tiptap/extension-mathematics` (extension name `Mathematics`, adds `inlineMath` + `blockMath` nodes). Writing LaTeX: type `$$...$$` (inline) or `$$$...$$$` (block) input rules, or use the toolbar button which prompts for LaTeX and inserts inline math. Clicking a rendered math node prompts to edit it. Built via `createMathematics(getEditor, t)` in `editor.tsx` (the node `onClick` handlers need the live editor, reached through a ref). `updateInlineMath`/`updateBlockMath` are called with an explicit `pos` - without it they read the original cursor selection and no-op inside a chain.
- Still **upstream / stubs:** `Attachment`, `Selection` are empty/partial stubs and/or registered upstream in `editor.tsx`.
- **Image** is a custom `imageAttachment` node (atom, block, draggable), not the upstream `@tiptap/extension-image`. It carries a single `attachmentId` attribute and never persists a `src`/base64 - the actual bytes live in the Dexie `attachments` table (see `src/db/CLAUDE.md`), reached via `useAttachmentActions`. Built via `createImage(getDeps)` (same shape as `createMathematics`): the node's React NodeView resolves `attachmentId` to a `Blob` and derives an object URL for rendering (revoked on unmount/id change), so nothing base64-encodes into the document JSON. Insertion happens through paste, drag-and-drop, and the toolbar button, all routed through a shared insertion pipeline that validates the file and creates the attachment row before inserting the node.
- **Audio** is a custom `audioAttachment` node (`extensions/Audio/Audio.ts`), built on the same shared `createAttachmentNode` factory as Image.
  It serializes as body `<audio data-attachment-id>` with no `src`; the bytes live in the Dexie `attachments` table (`kind: 'audio'`, plus a `duration` field), reached via `useAttachmentActions`.
  `AudioNodeView` (`extensions/Audio/AudioNodeView.tsx`) renders a custom player UI - play/pause, scrubber, elapsed/duration - wired to a hidden native `<audio>` element whose `src` is an object URL from the shared `useAttachmentObjectUrl` hook (`extensions/attachments/useAttachmentObjectUrl.ts`), revoked on unmount/id change.
  Recording goes through `useAudioRecorder` (`extensions/Audio/useAudioRecorder.ts`), a state-machine hook around `MediaRecorder` (idle -> requesting-permission -> recording -> stopped, with error/cancel paths that release the mic), driven by the toolbar's `AudioRecordButton` (`extensions/Audio/AudioRecordButton.tsx`).
  `AudioRecordButton` is now record-only (M3 Slice 4): the toolbar file-picker affordance it used to offer was removed. Uploading an audio file (including `.mp3`) goes through the generic **File** extension's toolbar button instead, which accepts any file type; pasting/dropping an `audio/*` file still creates an audio attachment via the shared paste/drop router.
- **Video** is a custom `videoAttachment` node (`extensions/Video/Video.ts`), built on the same `createAttachmentNode` factory. It serializes as body `<video data-attachment-id>` with no `src`; `VideoNodeView` uses a native `<video controls playsInline>` (no custom player skin needed) at the resolved object URL. Insertion is paste/drag-and-drop/toolbar-picker, same pipeline as Image/Audio.
- **File** is a custom `fileAttachment` node (`extensions/File/File.ts`), built on the same `createAttachmentNode` factory (M3 Slice 4). It serializes as body `<a data-attachment-id>` with no `href` (a file is not inline-renderable). `FileNodeView` shows a generic file icon, the original filename (`Attachment.name`), and an open/download link at the resolved object URL. Validation (`validateAttachmentFile`, `kind: 'file'`) has no MIME whitelist - any file type is accepted, gated only by a 50 MB size cap (`MAX_FILE_BYTES`). Insertion is **toolbar-picker only**: `file` has no single MIME prefix to disambiguate it from image/audio/video in the shared paste/drop router (`MIME_PREFIX` in `extensions/attachments/insert.ts`), so `insertAttachmentFiles` gives `kind: 'file'` a match-all path instead of a prefix filter, and `editor.tsx`'s `handlePaste`/`handleDrop` have no file branch.
  All four media nodes (Image/Audio/Video/File) share the `attachments/` core (`createAttachmentNode`, `useAttachmentObjectUrl`, `insert.ts`, `deps.ts`) and the confirm-before-delete `ConfirmDeleteButton`.
- **Excalidraw** is a custom `excalidrawAttachment` node (`extensions/Excalidraw/Excalidraw.ts`), built on the same shared `createAttachmentNode` factory as Image/Audio/Video/File.
  It serializes as body `<excalidraw-drawing data-attachment-id>` with no payload; the scene itself is stored as an `application/json` blob in the Dexie `attachments` table (`kind: 'excalidraw'`), with a self-generated SVG snapshot cached in `Attachment.preview`.
  `ExcalidrawNodeView` is a passive, live-queried SVG preview with tap-to-edit and an overlaid confirm-before-delete control.
  One shared `ExcalidrawDialog`, owned by `editor.tsx` and opened through `AttachmentDeps.openExcalidraw`, contains the live canvas and imports Excalidraw's stylesheet.
  Persistence is commit-on-Save: a new drawing creates its attachment and inserts its node only after Save, while editing updates the existing blob and preview without changing the body.
  Cancel discards changes, Delete removes the node through orphan GC, and both actions are confirm-guarded where needed.
  `scene.ts` holds JSON serialization helpers and removes transient collaboration state that cannot survive JSON serialization.
  `sceneToSvgString` dynamically imports `@excalidraw/excalidraw` because eagerly importing the package touches `canvas.getContext()` at module scope, which crashes under jsdom without the native `canvas` package.
- **Text styling via `@tiptap/extension-text-style`.** Four Pattern A extensions ride on the `textStyle` mark (registered once as `TextStyle` in `editor.tsx`); each wraps an upstream helper from that single package and returns a **custom-component** button:
  - **Text color** (`extensions/Color/`, name `color`) - custom `TextColorButton` popover over the shared `src/components/color-picker/ColorPickerPanel` (palette `TEXT_COLORS`). `setColor`/`unsetColor`.
  - **Highlight** (`extensions/Highlight/`, name `backgroundColor`, wraps `BackgroundColor`) - custom `HighlightButton`, same popover/panel as text color but palette `HIGHLIGHT_COLORS` and `setBackgroundColor`/`unsetBackgroundColor`. Rendered next to color in `FormatSection`.
  - **FontFamily** (`extensions/FontFamily/`, name `fontFamily`) and **FontSize** (`extensions/FontSize/`, name `fontSize`) - custom dropdown buttons built on the shadcn `Select` (`ui/select.tsx`). A `__default__` sentinel item maps to `unsetFontFamily`/`unsetFontSize` (Radix `Select.Item` forbids an empty-string value). Both live in their own `FontSection`.
  - The legacy `menus/ToolbarButton.tsx` and the `extensions/text-color/` folder were removed; the `Color/` vs `text-color/` duplicate is resolved (kept `Color/`).
  - **Live color preview.** In the custom (react-colorful) picker, dragging only **previews** the color on the selected text and commits (a real `setColor`/`setBackgroundColor` mark) on pointer **release** - so a drag is one clean undo step, not one per mouse-move, and the popover never loses focus mid-drag. The preview is a ProseMirror inline decoration held by the `colorPreview` extension (`extensions/color-preview.ts`, registered in `editor.tsx`): the buttons capture the selection range on popover open, call `previewColor(editor, {from,to,style})` during the drag and `clearColorPreview(editor)` on release/close, and commit the mark to the stored range via `setTextSelection(...)` **without** `focus()` (so the popover stays open). `ColorPickerPanel` exposes an optional `onPreview` (drag) alongside `onChange` (commit); the card picker omits `onPreview` and keeps its immediate live behavior.
- Both toolbar sections now consume extension `button` factories via `ExtensionButtonBar` (Pattern A). List buttons switch directly between bullet/ordered/task (no `can()` gating) and, via `extensions/list-toggle.ts` (`toggleWholeList`), convert the **whole** list when the cursor is collapsed inside one - not just the current item (needed because `taskList` uses a different item type than bullet/ordered). An explicit selection is respected as-is. Mark buttons (`Bold`/`Italic`/`Strike`/`Underline`/`Clear`/`Color`) and block buttons (`Heading` H1-H3, `Blockquote`, `Mathematics`) each set `toggle: true` so they render as toggle-styled toolbar buttons with an active highlight. The toolbar row (in `editor.tsx`) is `HeadingSection` + `FormatSection` + `ListSection` + `BlocksSection` + `FontSection`, each a thin `ExtensionButtonBar` wrapper, with vertical `Separator`s between groups. `FormatSection` references `bold`/`italic`/`underline`/`strike`/`clear`/`color`/`backgroundColor`; `BlocksSection` references `blockquote` + `Mathematics`; `HeadingSection` references `heading`; `FontSection` references `fontFamily` + `fontSize`. The Mathematics (LaTeX) button uses a custom `Latex` icon (`src/components/icons/LatexIcon.tsx`, a "TeX" wordmark) registered in `icons.ts`.
- The `History/` empty variant has been removed; only `history/` remains.

## Testing extensions (Vitest)

Tests run **headless** — no DOM render needed. Build `new Editor({ extensions: [Document, Paragraph, Text, <Ext>] })` from `@tiptap/core`, then:

- drive `editor.commands.*` and assert `editor.getHTML()` / `editor.isActive(...)`;
- pull the button via `editor.extensionManager.extensions.find(e => e.name === '<name>').options.button({ editor, t })` and assert its `componentProps` (`icon`, `tooltip`, `shortcutKeys`) and that `action()` flips `isActive()`;
- trigger markdown input rules with `editor.view.someProp('handleTextInput', (f) => f(editor.view, from, from, ' '))`.

`extensions/Bold/Bold.test.ts` is the canonical template. Run `pnpm test`.

When editing here, follow Pattern A for new work and migrate the above — don't add more Pattern B arrays.
