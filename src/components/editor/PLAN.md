# PLAN — `src/components/editor` (Milestone 1 detail)

This folder is the focus of **M1** (see [root PLAN.md](../../../PLAN.md)). Goal: stand up testing, standardize on the canonical pattern ([ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md)), and ship each editor extension with a test.

## 1. Test tooling (prerequisite)

- [x] **Vitest** + **React Testing Library** (+ `@testing-library/jest-dom`) configured via a standalone `vitest.config.ts` (jsdom env, `src/test/setup.ts`, `@/` alias). Scripts: `test` (`vitest run`), `test:watch`.
- [ ] **Playwright** E2E + `test:e2e` script — still to add.
- Reuse `fake-indexeddb` for any test that touches the data layer.

> Extension tests run **headless**: build a `new Editor({ extensions })` from `@tiptap/core`, drive commands / the `button` factory, and assert `editor.getHTML()` / `isActive(...)`. Markdown input rules are exercised via `editor.view.someProp('handleTextInput', ...)`. See `extensions/Bold/Bold.test.ts` for the template.

## 2. Cleanup

- Consolidate duplicate case-variant folders: `History/`↔`history/` done (empty `History/` removed); `Color/`↔`text-color/` still to resolve when the color extension lands.
- Expand `src/components/icons/icons.ts` to include every icon the toolbar buttons need (now also `Heading1`–`Heading3`, `List`, `Quote`, `Sigma`, `Strikethrough`, `RemoveFormatting`).

## 3. Standardize on Pattern A

- Flesh out each stub extension as `Tiptap<X>.extend()` with a `button` option returning `ActionButton` + a **string** `icon` + i18n `tooltip` + `shortcutKeys` (model on `extensions/Bold/Bold.ts` and `extensions/history/History.ts`).
- Register the wrapped extensions in `editor.tsx` (replace the direct upstream imports). Done so far: `Bold`, `Italic`, `Strike`, `Underline`, `Clear`, `BulletList`, `OrderedList`, `ListItem`, `TaskList`, `Heading`, `Blockquote`, `Mathematics`.
- Migrate `menus/toolbars/FormatSection.tsx` and `ListSection.tsx` to **consume extension-provided buttons** instead of defining `formatActions` arrays with inline Lucide icons. **Both done** — thin wrappers over `menus/ExtensionButtonBar.tsx` (resolves each extension's `button` by name; handles single or array returns). The legacy `ToolbarSection.tsx` was removed. A **blocks section** (`toolbars/BlocksSection.tsx`) now renders `Heading` (H1-H3), `Blockquote`, and `Mathematics` (`inlineMath`). Remaining toolbar work: migrate `TextColorPickerButton` (still legacy, uses `ToolbarButton.tsx`) onto `ExtensionButtonBar`, and consider collapsing the 3 heading buttons into a dropdown.

## 4. Extension order (each shipped with a test)

1. Basic marks — **Bold** ✅, **Italic** ✅, **Strike** ✅, **Underline** ✅, **Clear formatting** ✅.
2. Lists & blocks — **BulletList** ✅, **OrderedList** ✅, **ListItem** ✅ (structural, no button), **Heading** ✅ (level 1–3 button array), **Blockquote** ✅ (markdown `>` showcase), **TaskList** ✅.
3. Styling — **Color** / **text-color**, **Highlight**, **FontFamily**, **FontSize**.
4. Math — **Mathematics** ✅ (inline KaTeX via `@tiptap/extension-mathematics`; `katex` CSS imported in `editor.tsx`).
5. Media — **Image**, **Video**, **Attachment** (depends on attachment storage, `src/db/PLAN.md`).
6. **Excalidraw** drawing — last (heaviest integration).

> Shipped with tests: `Bold`, `Italic`, `Strike`, `Underline`, `Clear`, `BulletList`, `OrderedList`, `ListItem`, `TaskList`, `Heading`, `Blockquote`, `Mathematics` (38 headless tests). The **list section** is migrated to Pattern A (via `ExtensionButtonBar`); `FormatSection` is still legacy, so `Heading`/`Blockquote`/`Math` have no toolbar UI yet (reachable via markdown input / shortcuts).

## 5. Tests per extension

- Unit/component (Vitest + RTL): toggling the button changes editor state and active state; shortcut keys fire the command; tooltip text resolves via i18n.
- E2E (Playwright): a smoke test of the editor with the toolbar — type, format, and assert the rendered HTML.
