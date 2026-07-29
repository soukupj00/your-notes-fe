# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Open-source self-hosted PWA note-taking app (Google Keep alternative). Mobile-first React SPA with offline support via IndexedDB. Backend sync server is a separate repository — this repo is frontend-only.

## Documentation map

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary (canonical meaning of Note, Tag, Attachment, Sync, etc.).
- [`PLAN.md`](./PLAN.md) — overall roadmap and milestone order.
- [`docs/adr/`](./docs/adr/) — architecture decision records.
- Per-area docs (each folder has a `CLAUDE.md` = how it works + `PLAN.md` = what's left):
  [`src/db`](./src/db/CLAUDE.md), [`src/hooks/data`](./src/hooks/data/CLAUDE.md), [`src/components/editor`](./src/components/editor/CLAUDE.md), [`src/context`](./src/context/CLAUDE.md).

## Commands

```bash
pnpm dev          # start Vite dev server
pnpm build        # tsc + vite build
pnpm preview      # preview production build locally
pnpm seed         # seed IndexedDB with dummy notes (ts-node)
```

Package manager is **pnpm**. Do not use npm or yarn.

```bash
pnpm check        # biome check --write (lint + format + import sort, applies safe fixes)
pnpm check:ci     # biome ci .        (non-mutating gate, used in CI)
pnpm format       # biome format --write
pnpm test         # Vitest run (unit/component/data) — wired up in M1
pnpm test:watch   # Vitest watch mode
```

Still planned (see [M0/M1 in PLAN.md](./PLAN.md) — not yet wired up):

```bash
pnpm test:e2e     # Playwright — not yet added
```

> `pnpm lint` (ESLint) is being **replaced by Biome** — see [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md).

## Architecture

### Data layer (`src/db/`, `src/hooks/data/`, `src/models.ts`)

All persistence is via **Dexie** (IndexedDB wrapper). The schema lives in `src/db/db.ts` as `NotesDB extends Dexie`. Domain models are in `src/models.ts` (`Note`, `Tag`, `NoteTag`, `NoteImage`, `NoteAudio`, `NoteFile`).

Data access uses dedicated hooks in `src/hooks/data/`:
- `useNotes` / `useNote` — live queries via `useLiveQuery` from `dexie-react-hooks`
- `useNoteActions` / `useTagActions` — CRUD mutations (create/update/delete)
- `useNoteFeed` — the one feed query: lifecycle/tag scoping plus fuzzy ranked search (Fuse.js, `src/lib/note-search.ts`)
- `useNotesByTag`, `useTagsForNote` — relationship queries via the `noteTags` join table

Search/filter state is **not** in a context - it lives in the URL as typed TanStack search params (`q`, `sort`, `dir`, `tags`), validated by `src/lib/note-search-params.ts` and read through `useNoteSearchState()`.
The `NotesProvider` that used to hold the query is gone: a searched feed is now shareable, refresh-proof, and steppable with the back button.

### Editor (`src/components/editor/`)

Built on **TipTap v3**. The core `Editor` component (`editor.tsx`) composes extensions and renders `EditorContent`.

Each editor extension lives in its own folder under `src/components/editor/extensions/<ExtensionName>/`. The pattern is:
1. A TypeScript file that extends the upstream TipTap extension and adds a `button` option:
   ```ts
   export const Bold = TiptapBold.extend<BoldOptions>({
     addOptions() {
       return {
         ...this.parent?.(),
         button: ({ editor, t }) => ({
           component: ActionButton,
           componentProps: { action, isActive, icon: "Bold", tooltip, shortcutKeys },
         }),
       };
     },
   });
   ```
2. An `index.ts` that re-exports it.

The `icon` prop is a **string key** resolved via `src/components/icons/icons.ts`, which maps names to Lucide icon components. When adding a new icon for a toolbar button, add it to that registry.

`ActionButton` (`src/components/ui/ActionButton.tsx`) is the shared toolbar button: wraps a Radix Toggle/Button with Tooltip and resolves the icon string from the registry.

> **Canonical vs. legacy.** This per-extension pattern (Pattern A) is the **canonical** one — see [ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md). So far `Bold`, `BulletList`, `Heading`, `Blockquote`, `Mathematics`, and `history` use it (each with a headless Vitest test) and are registered as the wrapped versions in `editor.tsx`; the remaining extension folders are still stubs or upstream registrations. The legacy toolbars (`menus/toolbars/FormatSection.tsx`, `ListSection.tsx`) use a centralized `formatActions` array with inline Lucide imports; they are being migrated to consume extension-provided buttons. See [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md).

### Routing (`src/routes/`, `src/routeTree.gen.ts`)

**TanStack Router** with file-based routing ([ADR 0008](./docs/adr/0008-tanstack-router-over-react-router.md)). Route modules live in `src/routes/`; the `@tanstack/router-plugin` Vite plugin (wired in both `vite.config.ts` and `vitest.config.ts`) regenerates `src/routeTree.gen.ts` from them. That file is **generated and committed** — never edit it; it is excluded from Biome and `tsc` reads it directly. Colocated `*.test.tsx` files inside `src/routes/` are excluded from generation via `routeFileIgnorePattern`.

Routes: `/` (active feed), `/archive`, `/trash`, `/tag/$id`, `/settings`, `/settings/labels`.
The four feed routes share one `validateSearch` (`validateNoteSearch`), which is what makes the search box, sort menu, and label filters URL-driven; the Navbar hides the search box on routes without a feed. Route modules stay thin — they pick a scope and a title and delegate to a view (`NotesView`, or a page in `src/pages/`).

`App.tsx` is the composition root: providers (Theme → Preferences → Tooltip → ViewMode) wrap `<RouterProvider>`, and the `declare module '@tanstack/react-router'` block registers the router's types so `<Link to>` and params are type-checked.

### Nav shell (`src/components/layout.tsx`, `src/components/nav/`)

Keep pattern: a persistent left sidebar on desktop, the same `SideNav` inside a left-anchored drawer (hamburger in the `Navbar`) on mobile. `navItems.ts` is the single source of destinations so the two can't drift. Below the fixed destinations, `SideNav` lists every tag as a link to `/tag/$id`.

Quick capture is one list of five starts (`src/components/notes/quickCaptureActions.ts`) rendered two ways so they cannot drift: a `＋` speed-dial FAB on mobile (`QuickCaptureBar`) and inline icons on the desktop "Take a note" bar. Media starts carry a `capture` intent that the editor auto-runs on open.

A11y: every view renders an `<h1 tabIndex={-1}>` and calls `useFocusOnMount` on it, so a navigation moves focus to the destination heading instead of stranding it on the link.

### Tags / labels (`src/components/tags/`, `src/pages/labels.tsx`)

`NoteTagsBar` (pills + the "＋ Label" popover) is the one place labels are assigned; it resolves an unsaved draft's id lazily through the editor's `ensureNoteId`, the same queue attachments use. `TagPills` renders a note's labels read-only on `NoteCard`, tinted from the shared Note/Tag palette (`lib/note-colors.ts`) via `NoteColorPicker`. `/settings/labels` (`src/pages/labels.tsx`) is the manage view: create, inline rename, colour, merge-into, delete.

### Backup (`src/lib/backup.ts`, `src/components/settings/`)

The whole database exports to a `.zip`: `manifest.json` (notes, tags, noteTags, attachment metadata, the `settings` table) plus one entry per attachment blob at `attachments/<id>` (and `attachments/<id>.thumb`).
Zipping is `fflate`.
`parseBackupZip` is the only validation gate and never writes - restore is replace-all, so an unreadable archive must be rejected while the user's data is still intact.
`restoreBackup` wipes and rewrites in one Dexie transaction, and the UI (`BackupSection`) offers a checked-by-default "save my current data first" inside the confirm dialog - cancelling or failing that save abandons the import.
Saving always goes through `requestSaveTarget`, which asks for the destination *before* the bytes are built (`showSaveFilePicker` needs the click's user activation) and reports `confirmed: false` on the Firefox/Safari anchor fallback, where we must not claim the file landed.
Manifest rows are validated with `z.looseObject`, so unknown (future) fields survive a round-trip.

### Theming (`src/themes.ts`, `src/context/themeProvider.tsx`)

Colors use **OKLCH** values defined in `src/themes.ts` for `light` and `dark` tokens. `ThemeProvider` (`src/context/themeProvider.tsx`) is a **custom** provider (not `next-themes`, despite that package being installed): it persists the choice to `localStorage` and toggles the `light`/`dark` class on `<html>`, supporting a `system` mode via `prefers-color-scheme`. Theme switching is done at the provider level — no per-component theme logic.

### i18n (`src/i18n.ts`)

Uses **i18next** with browser language detection. Translations are loaded from `/public/locales/<lng>/translation.json`. Fallback language is `en`. The `t()` function is passed into extension button factories for tooltip translations.

### Path alias

`@/` resolves to `src/`. Use it for all internal imports.

## Tooling & CI/CD

> Target state — being rolled out in [M0](./PLAN.md). Decisions: [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md) (Biome), [ADR 0006](./docs/adr/0006-ci-cd-and-container-image-distribution.md) (pipeline).

- **Lint + format: Biome** (single tool, config in `biome.json`), replacing ESLint + Prettier. Tailwind class sorting via Biome's nursery `useSortedClasses`. Biome does not format Markdown/YAML.
- **Pre-commit (husky + lint-staged):** runs `biome check --write` on staged files — applies **safe** fixes (format, import sort, safe lint) and re-stages; remaining errors block the commit. Unsafe fixes are never auto-applied.
- **Toolchain pinning:** Node 20 (`.nvmrc`), pnpm via `corepack` pinned by `package.json` `packageManager`. The `Dockerfile` uses `corepack enable` + `pnpm install --frozen-lockfile`.
- **GitLab pipeline** (`.gitlab-ci.yml`): keeps the GitLab SAST + secret-detection templates and adds stages `quality` (`biome ci` + typecheck) → `test` (Vitest + Playwright, as suites land in M1) → `build` (`pnpm build`, `dist/` artifact) → `publish` (Kaniko build of the `Dockerfile`, push to `$CI_REGISTRY_IMAGE`). Self-hosters consume the published Container Registry image.

## Development methodology: pragmatic TDD

Feature work follows **red → green → refactor**, applied pragmatically per layer (see [ADR 0003](./docs/adr/0003-testing-stack-vitest-and-playwright.md)):

- **Test-first (mandatory)** for pure logic/utilities, the Dexie data layer (with `fake-indexeddb`), hooks, and component **behavior** (interactions, contracts like "deleting shows an undo toast"). For a user flow, write the **Playwright acceptance test before** the feature.
- **Build-then-test** for purely visual layout (masonry spacing, shadows, OKLCH rendering); afterward add tests that lock **behavior and accessibility** (roles, labels, keyboard nav) — not pixels.
- **Per unit:** 1) write the failing test against the defined contract/template, 2) implement the minimum to pass, 3) refactor for readability and de-duplication with tests as the safety net.
- Each extension (Pattern A), data hook, and user flow lands **with its tests in the same change**. CI gates on the full suite once M1 wires it up.

## Key conventions

- **Icons**: Always use string keys in `src/components/icons/icons.ts` — never import Lucide icons directly into extension button configs.
- **New TipTap extensions**: Follow the per-folder pattern with `ExtensionName.ts` + `index.ts`. Add the button factory with `ActionButton` as the component.
- **DB schema changes**: Increment the Dexie version number in `src/db/db.ts` and add a migration if existing data must be preserved.
- **Dates**: All timestamps stored as ISO strings (`.toISOString()`).
- **IDs**: Use `uuid` (`v4`) for all entity IDs.
- **Tailwind v4** is in use (CSS-based config, not `tailwind.config.js` plugins). `tw-animate-css` provides animation utilities.
- **Lint/format is being migrated to Biome** (one tool for both); see the Tooling & CI/CD section above. Until M0 lands, the repo still has ESLint + Prettier wired into husky/lint-staged.
