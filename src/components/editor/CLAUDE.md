# CLAUDE.md — `src/components/editor` (TipTap editor)

How the rich-text editor is built. The canonical extension/toolbar pattern is fixed by [ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md). See [`PLAN.md`](./PLAN.md) for the M1 work that brings the code in line with it.

## Structure

- `editor.tsx` — the `Editor` React component: `useEditor({ extensions, content, editable, onUpdate })`, renders `EditorContent`. Syncs external `content` prop into the editor via `setContent`.
- `extensions/<Name>/` — one folder per editing capability. Each has `<Name>.ts` (the extension) and `index.ts` (re-export).
- `menus/` — `ToolbarButton.tsx`, `ToolbarSection.tsx`, and `toolbars/FormatSection.tsx` / `ListSection.tsx`.
- `ShortcutKey.tsx` — renders keyboard-shortcut hints.
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

- **Wrapped extensions following Pattern A, each with a headless test:** `Bold`, `Italic`, `Strike`, `Underline`, `Clear` (clear formatting), `BulletList`, `Heading` (level 1–3 button array), `Blockquote` (markdown `>` showcase), `Mathematics` (inline KaTeX), plus `history`. `editor.tsx` registers all of these wrapped versions (and imports `katex/dist/katex.min.css`). `Clear` is not a mark - it is an `Extension.create` whose button runs `clearNodes().unsetAllMarks()`.
- Still **upstream / stubs:** `OrderedList`, `ListItem`, `TaskList`, `Image`, `Highlight`, `Excalidraw` (drawing — deferred), `Video`, `Attachment`, `FontFamily`, `FontSize`, `Color`, `Selection` are empty/partial stubs and/or registered upstream in `editor.tsx`.
- `menus/toolbars/FormatSection.tsx` and `ListSection.tsx` still use the **legacy Pattern B** (`formatActions` array with inline Lucide JSX). They do **not** yet consume the extension `button` factories, so the wrapped-but-not-in-legacy buttons (`Heading`/`Blockquote`/`Mathematics`) have no toolbar button yet (reachable via markdown input rules / keyboard shortcuts).
- Remaining duplicate case-variant folders: `Color/` vs `text-color/` (resolve when the color extension is fleshed out). The `History/` empty variant has been removed; only `history/` remains.

## Testing extensions (Vitest)

Tests run **headless** — no DOM render needed. Build `new Editor({ extensions: [Document, Paragraph, Text, <Ext>] })` from `@tiptap/core`, then:
- drive `editor.commands.*` and assert `editor.getHTML()` / `editor.isActive(...)`;
- pull the button via `editor.extensionManager.extensions.find(e => e.name === '<name>').options.button({ editor, t })` and assert its `componentProps` (`icon`, `tooltip`, `shortcutKeys`) and that `action()` flips `isActive()`;
- trigger markdown input rules with `editor.view.someProp('handleTextInput', (f) => f(editor.view, from, from, ' '))`.

`extensions/Bold/Bold.test.ts` is the canonical template. Run `pnpm test`.

When editing here, follow Pattern A for new work and migrate the above — don't add more Pattern B arrays.
