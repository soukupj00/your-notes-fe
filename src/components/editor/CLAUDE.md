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

The code does **not** yet fully follow Pattern A:

- `editor.tsx` registers **upstream** TipTap extensions directly (`Document, Paragraph, Text, Bold, Italic, Strike, Underline, BulletList, OrderedList, ListItem, Color, TextStyle`) — not the wrapped `extensions/*` versions.
- Only `extensions/Bold/Bold.ts` and `extensions/history/History.ts` actually define a `button`; the rest (`Italic`, `Strike`, `Image`, `Heading`, `Highlight`, `TaskList`, `Excalidraw`, `Video`, `Attachment`, `FontFamily`, `FontSize`, `Clear`, `Color`, `TextUnderline`, `Selection`, `BulletList`, `OrderedList`, `ListItem`) are **empty/partial stubs**.
- `menus/toolbars/FormatSection.tsx` and `ListSection.tsx` use the **legacy Pattern B**: a local `formatActions` array with inline Lucide JSX icons rendered through `Toolbar`/`ToolbarSection`. This is what `editor.tsx` currently renders.
- Duplicate case-variant folders exist: `History/` vs `history/`, and `Color/` vs `text-color/`. Consolidate to one casing.

When editing here, follow Pattern A for new work and migrate the above — don't add more Pattern B arrays.
