# PLAN — Overall roadmap

This is the top-level roadmap for the frontend (React SPA + PWA). It tracks the original brief in [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) against current progress, and links to per-area plans. The backend sync server lives in a **separate repository**; this repo only plans the client-side of sync.

See [`CONTEXT.md`](./CONTEXT.md) for the domain glossary and [`docs/adr/`](./docs/adr/) for the decisions that shaped this plan.

## Current state (snapshot)

- ✅ Vite + React 19 + TS + Tailwind v4 + shadcn/Radix scaffolding; VitePWA configured.
- ✅ Dexie data layer (`src/db`) with Notes/Tags/NoteTags + attachment tables; seeders.
- ✅ Data-access hooks (`src/hooks/data`): live queries + CRUD + search.
- ✅ TipTap editor with basic marks (bold/italic/strike/underline), lists, text color.
- ✅ i18n (en/cs) and light/dark theming via OKLCH tokens.
- 🚧 `App.tsx` is still a demo harness — no real note list / create / edit flow yet.
- 🚧 Most editor extensions are scaffolded folders only; two toolbar patterns coexist.
- ❌ No test runner installed (only `fake-indexeddb` helper present).
- ❌ No sync, no accounts, no accessibility themes, no animations.

## Milestones

### M0 — Tooling & CI/CD  (prerequisite)
Decisions: [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md) (Biome), [ADR 0006](./docs/adr/0006-ci-cd-and-container-image-distribution.md) (pipeline).

- **Migrate to Biome** (replaces ESLint + Prettier):
  - Add `biome.json` (recommended rules + `organizeImports` + formatter; nursery `useSortedClasses` configured for `className`/`cn`/`clsx`/`cva`).
  - Remove `eslint*` + `prettier*` deps, `eslint.config.ts`, and Prettier configs.
  - Add scripts `check` (`biome check --write`), `check:ci` (`biome ci .`), `format`; drop `lint`.
  - Repoint `lint-staged` to `biome check --write --no-errors-on-unmatched` (apply safe fixes + re-stage; block on the rest). Keep husky `pre-commit`.
- **Pin the toolchain:** add `packageManager: "pnpm@<lockfile-version>"` + `.nvmrc` (Node 20); change `Dockerfile` from `npm i -g pnpm` to `corepack enable` + `pnpm install --frozen-lockfile`.
- **GitLab pipeline** (`.gitlab-ci.yml`): keep the SAST + secret-detection templates; add stages `quality → test → build → publish`:
  - `quality` — `corepack enable && pnpm install --frozen-lockfile`, then `pnpm check:ci` + `pnpm tsc -b --noEmit` (pnpm store cached).
  - `test:unit` — `pnpm test` (Vitest); enabled once M1 adds tests.
  - `test:e2e` — Playwright via `mcr.microsoft.com/playwright` image; enabled with M1 (`rules`/`allow_failure` until suites exist).
  - `build` — `pnpm build`, artifact `dist/`.
  - `publish` — Kaniko build of the `Dockerfile`, push to `$CI_REGISTRY_IMAGE` tagged `$CI_COMMIT_SHORT_SHA` + `latest` (default branch) / git tag (releases); `rules` restrict to default branch and tags.

### M1 — Test foundation + editor extensions  ← current focus
- Install & configure **Vitest** + **React Testing Library** (reusing `fake-indexeddb`) and **Playwright**; add `test` / `test:e2e` scripts.
- Consolidate duplicate case-variant extension folders (`History/`↔`history/`, `Color/`↔`text-color/`).
- Standardize on the canonical toolbar pattern (extension-owned `button` + icon registry — [ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md)); migrate `FormatSection`/`ListSection`.
- Flesh out each scaffolded extension and register it in `editor.tsx`.
- Write a test per extension (existing and new).
- Detail: [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md).

### M2 — Real notes CRUD UI
- Replace the `App.tsx` demo with the note list + create/edit flow, wiring `NoteCard` / `NoteContent` / `NoteCreateMain` to the data hooks. Mobile-first, offline-first usable.

### M3 — Attachments & rich media
- Images, audio, video, files, and Excalidraw drawings end to end: extension → Dexie storage → render. See [`src/db/PLAN.md`](./src/db/PLAN.md) for storage strategy.

### M4 — Accessibility & polish
- Color-blindness / low-vision theme variants, descriptive icons, full i18n coverage, optional Motion/GSAP animations.

### M5 — Sync (client-side)
- Local-account/auth context, REST/HATEOAS API client, response caching, offline mutation queue, conflict resolution against Dexie. Backend lives in the separate repo.

## Per-area plans

- [`src/db/PLAN.md`](./src/db/PLAN.md) — schema versioning, attachment storage, sync metadata.
- [`src/hooks/data/PLAN.md`](./src/hooks/data/PLAN.md) — attachment actions, optimistic updates, mutation queue.
- [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md) — M1 extension work in detail.
- [`src/context/PLAN.md`](./src/context/PLAN.md) — auth context, accessibility themes.
