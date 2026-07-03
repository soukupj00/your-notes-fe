# CLAUDE.md — `src/components/editor` (TipTap editor)

How the rich-text editor is built. The canonical extension/toolbar pattern is fixed by [ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md). See [`PLAN.md`](./PLAN.md) for the M1 work that brings the code in line with it.

## Structure

- `editor.tsx` — the `Editor` React component: `useEditor({ extensions, content, editable, onUpdate })`, renders `EditorContent`. Syncs external `content` prop into the editor via `setContent`.
- `extensions/<Name>/` — one folder per editing capability. Each has `<Name>.ts` (the extension) and `index.ts` (re-export).
- `menus/` — `ExtensionButtonBar.tsx` (resolves + renders extension-owned Pattern A `button`s by name; the canonical way to compose a toolbar section — a factory may return one button or an array, e.g. Heading levels / undo+redo). `toolbars/FormatSection.tsx` and `toolbars/ListSection.tsx` are both migrated to Pattern A (thin wrappers over `ExtensionButtonBar`). The legacy `ToolbarSection.tsx` has been removed; `ToolbarButton.tsx` remains only because `extensions/text-color/TextColorPickerButton.tsx` still uses it (to be migrated with the Color work).
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

- **Wrapped extensions following Pattern A, each with a headless test:** `Bold`, `Italic`, `Strike`, `Underline`, `Clear` (clear formatting), `BulletList`, `OrderedList`, `TaskList`, `Heading` (dropdown, see below), `Blockquote` (markdown `>` showcase), `Mathematics` (LaTeX, see below), plus `history`. `editor.tsx` registers all of these wrapped versions (and imports `katex/dist/katex.min.css`). `Clear` is not a mark - it is an `Extension.create` whose button runs `clearNodes().unsetAllMarks()`. `ListItem` is wrapped only as a local re-export (structural child, no button); `TaskList` needs `TaskItem` (registered upstream in `editor.tsx`), and task-list checkbox/text layout is styled in `src/styles/globals.css` (`ul[data-type="taskList"]`).
- **Heading** contributes a **button array** (one toggle per level H1-H3); its section (`HeadingSection`) sits at the **start** of the toolbar (mobile-first: H2/H3 to be hidden on small screens later, leaving H1). Heading (and body) sizing/weight is set explicitly in `src/styles/globals.css` under `.tiptap h1/h2/h3` - the `prose prose-*` classes on the editor are inert because `@tailwindcss/typography` is not installed, and Tailwind preflight otherwise resets headings to `inherit`.
- **Mathematics** uses the bundled `@tiptap/extension-mathematics` (extension name `Mathematics`, adds `inlineMath` + `blockMath` nodes). Writing LaTeX: type `$$...$$` (inline) or `$$$...$$$` (block) input rules, or use the toolbar button which prompts for LaTeX and inserts inline math. Clicking a rendered math node prompts to edit it. Built via `createMathematics(getEditor, t)` in `editor.tsx` (the node `onClick` handlers need the live editor, reached through a ref). `updateInlineMath`/`updateBlockMath` are called with an explicit `pos` - without it they read the original cursor selection and no-op inside a chain.
- Still **upstream / stubs:** `Image`, `Highlight`, `Excalidraw` (drawing — deferred), `Video`, `Attachment`, `FontFamily`, `FontSize`, `Color`, `Selection` are empty/partial stubs and/or registered upstream in `editor.tsx`.
- Both toolbar sections now consume extension `button` factories via `ExtensionButtonBar` (Pattern A). List buttons switch directly between bullet/ordered/task (no `can()` gating) and, via `extensions/list-toggle.ts` (`toggleWholeList`), convert the **whole** list when the cursor is collapsed inside one - not just the current item (needed because `taskList` uses a different item type than bullet/ordered). An explicit selection is respected as-is. Mark buttons (`Bold`/`Italic`/`Strike`/`Underline`/`Clear`) and block buttons (`Heading` H1-H3, `Blockquote`, `Mathematics`) each set `toggle: true` so they render as toggle-styled toolbar buttons with an active highlight. The toolbar row (in `editor.tsx`) is `HeadingSection` + `FormatSection` + `TextColorPickerButton` + `ListSection` + `BlocksSection`, each a thin `ExtensionButtonBar` wrapper (except `TextColorPickerButton`, still its own legacy component), with vertical `Separator`s between groups. `BlocksSection` references `blockquote` + `Mathematics`; `HeadingSection` references `heading`. The Mathematics (LaTeX) button uses a custom `Latex` icon (`src/components/icons/LatexIcon.tsx`, a "TeX" wordmark) registered in `icons.ts`.
- Remaining duplicate case-variant folders: `Color/` vs `text-color/` (resolve when the color extension is fleshed out). The `History/` empty variant has been removed; only `history/` remains.

## Testing extensions (Vitest)

Tests run **headless** — no DOM render needed. Build `new Editor({ extensions: [Document, Paragraph, Text, <Ext>] })` from `@tiptap/core`, then:
- drive `editor.commands.*` and assert `editor.getHTML()` / `editor.isActive(...)`;
- pull the button via `editor.extensionManager.extensions.find(e => e.name === '<name>').options.button({ editor, t })` and assert its `componentProps` (`icon`, `tooltip`, `shortcutKeys`) and that `action()` flips `isActive()`;
- trigger markdown input rules with `editor.view.someProp('handleTextInput', (f) => f(editor.view, from, from, ' '))`.

`extensions/Bold/Bold.test.ts` is the canonical template. Run `pnpm test`.

When editing here, follow Pattern A for new work and migrate the above — don't add more Pattern B arrays.
