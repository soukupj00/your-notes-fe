# PLAN — `src/components/editor` (Milestone 1 detail)

This folder is the focus of **M1** (see [root PLAN.md](../../../PLAN.md)). Goal: stand up testing, standardize on the canonical pattern ([ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md)), and ship each editor extension with a test.

## 1. Test tooling (prerequisite)

- [x] **Vitest** + **React Testing Library** (+ `@testing-library/jest-dom`) configured via a standalone `vitest.config.ts` (jsdom env, `src/test/setup.ts`, `@/` alias). Scripts: `test` (`vitest run`), `test:watch`.
- [ ] **Playwright** E2E + `test:e2e` script — still to add.
- Reuse `fake-indexeddb` for any test that touches the data layer.

> Extension tests run **headless**: build a `new Editor({ extensions })` from `@tiptap/core`, drive commands / the `button` factory, and assert `editor.getHTML()` / `isActive(...)`. Markdown input rules are exercised via `editor.view.someProp('handleTextInput', ...)`. See `extensions/Bold/Bold.test.ts` for the template.

## 2. Cleanup

- Consolidate duplicate case-variant folders: `History/`↔`history/` done (empty `History/` removed); `Color/`↔`text-color/` **done** (kept `Color/`, removed `text-color/` and the legacy `menus/ToolbarButton.tsx`).
- Expand `src/components/icons/icons.ts` to include every icon the toolbar buttons need (now also `Heading1`–`Heading3`, `List`, `Quote`, `Sigma`, `Strikethrough`, `RemoveFormatting`).

## 3. Standardize on Pattern A

- Flesh out each stub extension as `Tiptap<X>.extend()` with a `button` option returning `ActionButton` + a **string** `icon` + i18n `tooltip` + `shortcutKeys` (model on `extensions/Bold/Bold.ts` and `extensions/history/History.ts`).
- Register the wrapped extensions in `editor.tsx` (replace the direct upstream imports). Done so far: `Bold`, `Italic`, `Strike`, `Underline`, `Clear`, `BulletList`, `OrderedList`, `ListItem`, `TaskList`, `Heading`, `Blockquote`, `Mathematics`.
- Migrate `menus/toolbars/FormatSection.tsx` and `ListSection.tsx` to **consume extension-provided buttons** instead of defining `formatActions` arrays with inline Lucide icons. **Both done** — thin wrappers over `menus/ExtensionButtonBar.tsx` (resolves each extension's `button` by name; handles single or array returns). The legacy `ToolbarSection.tsx` was removed. Toolbar sections: `HeadingSection` (H1-H3, at the start), `FormatSection` (marks + `color` + `backgroundColor`), `ListSection`, `BlocksSection` (`Blockquote` + `Mathematics`), `FontSection` (`fontFamily` + `fontSize`), divided by vertical `Separator`s. The color/highlight/font buttons are Pattern A extensions, so no legacy toolbar items remain. Mobile-first hiding is generic via `ButtonView.hideOnMobile` (`ExtensionButtonBar` wraps such buttons in `hidden sm:inline-flex`); Heading H2/H3 opt in. Remaining: choose which other buttons to hide on mobile after testing.

## 4. Extension order (each shipped with a test)

1. Basic marks — **Bold** ✅, **Italic** ✅, **Strike** ✅, **Underline** ✅, **Clear formatting** ✅.
2. Lists & blocks — **BulletList** ✅, **OrderedList** ✅, **ListItem** ✅ (structural, no button), **Heading** ✅ (H1–H3 buttons at toolbar start), **Blockquote** ✅ (markdown `>` showcase), **TaskList** ✅.
3. Styling — all on the `textStyle` mark via `@tiptap/extension-text-style`: **Color** ✅ (text color; `TextColorButton` popover over the shared `ColorPickerPanel`), **Highlight** ✅ (`BackgroundColor`; `HighlightButton`, same panel, `HIGHLIGHT_COLORS`), **FontFamily** ✅ + **FontSize** ✅ (shadcn `Select` dropdowns, own `FontSection`).
4. Math — **Mathematics** ✅ (KaTeX via bundled `@tiptap/extension-mathematics`; write LaTeX with `$$…$$` / `$$$…$$$`, button prompt-inserts, click a node to edit; `katex` CSS imported in `editor.tsx`).
5. Media — **Image**, **Video**, **Attachment** (depends on attachment storage, `src/db/PLAN.md`).
6. **Excalidraw** drawing — last (heaviest integration).

> Shipped with tests: `Bold`, `Italic`, `Strike`, `Underline`, `Clear`, `BulletList`, `OrderedList`, `ListItem`, `TaskList`, `Heading`, `Blockquote`, `Mathematics`, `Color`, `Highlight`, `FontFamily`, `FontSize`, plus `ExtensionButtonBar` (incl. the `hideOnMobile` wrap) and the shared `ColorPickerPanel` (61 tests). All toolbar sections render via Pattern A; no legacy toolbar items remain.

## 5. Tests per extension

- Unit/component (Vitest + RTL): toggling the button changes editor state and active state; shortcut keys fire the command; tooltip text resolves via i18n.
- E2E (Playwright): a smoke test of the editor with the toolbar — type, format, and assert the rendered HTML.
