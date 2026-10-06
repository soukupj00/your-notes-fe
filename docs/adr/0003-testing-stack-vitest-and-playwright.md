# 0003 — Testing stack: Vitest + Playwright

- Status: Accepted
- Date: 2026-06-15

## Context

The project brief requires unit tests and Playwright E2E, with a test accompanying each small feature (UI behavior and IndexedDB data). No test runner is installed yet — only `fake-indexeddb` and `indexeddbshim` helpers are present in devDependencies. The build already uses Vite.

## Decision

- **Vitest** for unit, component, and data-layer tests — it shares Vite's config/transform pipeline and the `@/` alias, minimizing setup.
- **React Testing Library** for component tests.
- **`fake-indexeddb`** (already a dependency) to exercise the Dexie layer in Node.
- **Playwright** for end-to-end browser tests, including PWA/offline flows.

### Workflow: pragmatic TDD (red → green → refactor)

The stack is used **test-first**, applied pragmatically per layer:

- **Test-first (mandatory):** pure logic/utilities, the Dexie data layer, hooks, and component **behavior** (interactions and contracts). For each user flow, the Playwright acceptance test is written **before** the feature.
- **Build-then-test:** purely visual layout (spacing, shadows, color rendering). Tests added afterward lock **behavior and accessibility** (roles, labels, keyboard nav), not pixels.
- **Per unit of work:** write the failing test against the defined contract/template → implement the minimum to pass → refactor with tests as the safety net.

The existing well-defined contracts — the Pattern A extension interface ([ADR 0004](./0004-canonical-editor-toolbar-pattern.md)) and the `src/hooks/data/` interfaces — make test-first tractable. Each extension, data hook, and user flow lands with its tests in the same change.

## Consequences

- Vitest reuses `vite.config.ts`, so the alias and plugins work without a parallel Jest config.
- Two test commands (`test` unit/component/data, `test:e2e` Playwright) — to be added in M1.
- Data tests import the same `db` module the app uses, with `fake-indexeddb/auto` providing IndexedDB (as the seeder already does).
- Choosing Vitest over Jest avoids a second toolchain; the trade-off is depending on the Vitest ecosystem, which is well-aligned with a Vite project.
