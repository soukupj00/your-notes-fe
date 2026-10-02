# 0004 — Canonical editor toolbar pattern: extension-owned buttons + icon registry

- Status: Accepted
- Date: 2026-06-15

## Context

Two toolbar patterns currently coexist in the editor, which is confusing and causes drift:

- **Pattern A - extension-owned button.** Each extension `.extend()`s its upstream TipTap extension and attaches a `button` option returning `{ component: ActionButton, componentProps: { icon: "<name>", ... } }`, where `icon` is a **string key** resolved through `src/components/icons/icons.ts`. Used by `extensions/Bold/Bold.ts` and `extensions/history/History.ts` at the time; since M6 slice 2 the one-button extensions are declarations in `extensions/formatting.ts` through `withButton`.
- **Pattern B - centralized toolbar array.** `menus/toolbars/FormatSection.tsx` and `ListSection.tsx` define a `formatActions` array with **inline Lucide JSX icons imported directly**, rendered through `Toolbar`/`ToolbarSection`. This is what `editor.tsx` actually renders today.

The inspiration repo (reactjs-tiptap-editor) uses Pattern A. Picking one is hard to reverse later because every extension and toolbar would need rewriting.

## Decision

**Pattern A is canonical.** Each extension owns its `button` and references icons by string key from the central `icons.ts` registry. `ActionButton` is the single shared button component. The legacy `FormatSection`/`ListSection` toolbars are migrated to **compose extension-provided buttons** into sections/dropdowns rather than redefining actions and importing icons directly.

## Consequences

- Extensions are self-contained: behavior, button, shortcut, and tooltip live together — easier to add, test, and reason about per extension.
- The icon registry is the single place icons are declared; it must be expanded as extensions are added. Toolbars stop importing Lucide directly.
- Migration cost: `FormatSection`/`ListSection` and `editor.tsx` must be reworked, and stub extensions filled in (M1, see `src/components/editor/PLAN.md`).
- Trade-off accepted: a centralized array is marginally simpler to skim, but it splits an extension's definition across files and duplicates icon wiring — rejected in favor of cohesion and consistency with the source project.
