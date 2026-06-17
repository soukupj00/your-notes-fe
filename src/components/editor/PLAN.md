# PLAN — `src/components/editor` (Milestone 1 detail)

This folder is the focus of **M1** (see [root PLAN.md](../../../PLAN.md)). Goal: stand up testing, standardize on the canonical pattern ([ADR 0004](../../../docs/adr/0004-canonical-editor-toolbar-pattern.md)), and ship each editor extension with a test.

## 1. Test tooling (prerequisite)

- Install & configure **Vitest** + **React Testing Library** (+ `@testing-library/jest-dom`) and **Playwright**.
- Add scripts: `test` (Vitest), `test:e2e` (Playwright). Vitest reuses `vite.config.ts` (so `@/` alias works).
- Reuse `fake-indexeddb` for any test that touches the data layer.

## 2. Cleanup

- Consolidate duplicate case-variant folders: keep one of `History/`↔`history/` and one of `Color/`↔`text-color/`; delete the other and fix imports.
- Expand `src/components/icons/icons.ts` to include every icon the toolbar buttons need (currently only `Bold`, `Italic`, `Underline`).

## 3. Standardize on Pattern A

- Flesh out each stub extension as `Tiptap<X>.extend()` with a `button` option returning `ActionButton` + a **string** `icon` + i18n `tooltip` + `shortcutKeys` (model on `extensions/Bold/Bold.ts` and `extensions/history/History.ts`).
- Register the wrapped extensions in `editor.tsx` (replace the direct upstream imports).
- Migrate `menus/toolbars/FormatSection.tsx` and `ListSection.tsx` to **consume extension-provided buttons** (compose them into sections/dropdowns) instead of defining `formatActions` arrays with inline Lucide icons.

## 4. Extension order (each shipped with a test)

1. Basic marks — **Bold** (done), **Italic**, **Strike**, **Underline**, **Clear formatting**.
2. Lists & blocks — **BulletList**, **OrderedList**, **ListItem**, **Heading**, **TaskList**.
3. Styling — **Color** / **text-color**, **Highlight**, **FontFamily**, **FontSize**.
4. Media — **Image**, **Video**, **Attachment** (depends on attachment storage, `src/db/PLAN.md`).
5. **Excalidraw** drawing — last (heaviest integration).

## 5. Tests per extension

- Unit/component (Vitest + RTL): toggling the button changes editor state and active state; shortcut keys fire the command; tooltip text resolves via i18n.
- E2E (Playwright): a smoke test of the editor with the toolbar — type, format, and assert the rendered HTML.
