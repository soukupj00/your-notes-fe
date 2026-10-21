# Technology and packages

Every technology in use, grouped by concern, with the reason it is there.
Versions are as of 2026-08 (`package.json` is authoritative).
A product constraint shapes the whole list: **no external network requests at runtime** (no font CDN, no analytics, no remote assets) and bundle weight is a cost the user feels at PWA install.

## Core platform

| Technology | Role | Rationale |
|---|---|---|
| React 19 | UI framework | Set by the brief; concurrent features and modern hooks |
| TypeScript (strict, `erasableSyntaxOnly`) | Language | End-to-end typing from Dexie rows to route params |
| Vite 7 | Build/dev | Fast HMR; plugin host for PWA, router codegen, Tailwind |
| pnpm (pinned via corepack, `packageManager`) | Package manager | Deterministic installs; Node 22 via `.nvmrc` |

## Routing and state

| Technology | Role | Rationale |
|---|---|---|
| TanStack Router | File-based routing | Chosen over React Router for **typed search params** - the URL is the app's state model, so params being first-class and validated decided it ([ADR 0008](../adr/0008-tanstack-router-over-react-router.md)); `routeTree.gen.ts` generated and committed |
| Zod 4 | Runtime validation | URL params, the preferences blob, backup manifests (`z.looseObject` so unknown future fields survive a round-trip), and every server response at the boundary |

There is no client-state library: Dexie live queries + URL params + small contexts cover it (see [01-architecture.md](./01-architecture.md)).

## Data layer

| Technology | Role | Rationale |
|---|---|---|
| Dexie 4 + dexie-react-hooks | IndexedDB wrapper + `useLiveQuery` | Versioned schema with migrations, transactions, and reactive queries without a cache layer ([ADR 0001](../adr/0001-local-first-storage-with-dexie.md)) |
| `crypto.randomUUID` (through `lib/rows.ts`) | Entity ids | Collision-free across devices - the property adopt-on-sign-in relies on |
| fflate | Zip backup | Small, fast; whole-database export/import |

## Editor

| Technology | Role | Rationale |
|---|---|---|
| TipTap 3 (~25 `@tiptap/*` packages) | Rich-text editor | ProseMirror-based, per-extension architecture matching the app's own plugin pattern ([ADR 0004](../adr/0004-canonical-editor-toolbar-pattern.md)); set by the brief |
| KaTeX (`@tiptap/extension-mathematics`) | Math rendering | Self-hosted, no CDN |
| @excalidraw/excalidraw | Drawings | Whiteboard scenes as attachments; edited in a modal, previewed as stored SVG |
| dompurify | HTML sanitization | The Body is stored HTML; sanitize before rendering outside the editor |

## UI and design system

| Technology | Role | Rationale |
|---|---|---|
| Tailwind CSS 4 | Styling | CSS-based config; OKLCH design tokens in `globals.css` are the single color source |
| Radix UI primitives + vendored shadcn | Accessible components | Dialog, popover, tooltip, switch etc. with a11y built in; vendored, customised (e.g. the sidebar shell, [ADR 0010](../adr/0010-shadcn-sidebar-as-nav-shell.md)) |
| Motion | Animation | All motion gated on reduced-motion; library of record per `PRODUCT.md` (GSAP from the original brief was dropped) |
| lucide-react | Icons | Via a string-key registry (`icons.ts`), never imported directly into feature code |
| @dnd-kit/* | Drag and drop | Toolbar customisation ordering; keyboard-accessible |
| @fontsource-variable/* (Bricolage Grotesque, Work Sans) | Typography | Self-hosted fonts - the no-CDN constraint made `@fontsource` mandatory |
| sonner | Toasts | Undo affordances (delete, conflict notices) |
| fuse.js | Fuzzy search | Ranked in-memory search over the feed; no server, no index to maintain |
| class-variance-authority, clsx, tailwind-merge | Class composition | shadcn idiom |
| react-hotkeys-hook | Shortcuts | `mod+K` etc.; shortcuts shown only to Fine pointers ([ADR 0016](../adr/0016-width-decides-layout-pointer-decides-affordances.md)) |
| driver.js | Tour spotlight | The one place the Tour touches a library; all Tour logic is dependency-free in `lib/tour/` ([ADR 0024](../adr/0024-a-welcome-at-launch-the-tour-in-settings.md)) |
| react-colorful, color, country-flag-icons | Small utilities | Color picking, color math, locale flags |

## PWA and i18n

| Technology | Role | Rationale |
|---|---|---|
| vite-plugin-pwa + Workbox (`workbox-window`) | Service worker, manifest, precache | `registerType: 'prompt'` for an explicit update flow |
| i18next + react-i18next + http-backend + browser-languagedetector | i18n | `en`/`cs` from day one, `en` fallback; bundles gated against key drift by test |

## Testing and quality

| Technology | Role | Rationale |
|---|---|---|
| Vitest 4 + React Testing Library | Unit/component/data tests | 900+ tests; behavior and contracts, not pixels ([ADR 0003](../adr/0003-testing-stack-vitest-and-playwright.md)) |
| fake-indexeddb | IndexedDB in tests | Real Dexie code paths, including migration tests |
| Playwright | E2E (`e2e/`, desktop + mobile projects) | Wired in M4 slice 5 because the Tour needed it: jsdom measures every element 0x0, so spotlight behavior is invisible to it |
| Biome | Lint + format (one tool) | Replaced ESLint + Prettier ([ADR 0005](../adr/0005-biome-replaces-eslint-prettier.md)); ESLint remains only for `react-hooks` rules until Biome covers them |
| husky + lint-staged | Pre-commit | Safe fixes applied and re-staged; remaining errors block |

## Delivery

| Technology | Role | Rationale |
|---|---|---|
| GitLab CI | Pipeline | `quality → test → build → publish`, plus SAST + secret detection ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)) |
| Docker + Kaniko | Container image | Published to the GitLab registry; the backend image embeds the built PWA and becomes the self-hoster's artifact |

## The backend repo

Fastify, SQLite via `better-sqlite3`, Drizzle ORM, Caddy for TLS, `compose.yml`; REST + HAL (`application/hal+json`); shared Zod contract vendored into this repo.
Rationale in [05-server.md](./05-server.md).

## For the paper

- The through-line to argue: nearly every pick traces to one of three constraints - **offline/self-contained** (Dexie, fontsource, no CDN), **typed end to end** (TS, Zod, TanStack Router, the shared contract), or **accessible by default** (Radix, reduced-motion gating, icon registry).
- Divergences from the original brief worth documenting honestly: GSAP → Motion, ESLint/Prettier → Biome, Playwright deferred then adopted when the Tour demanded it, and the backend framework question (FastAPI/Laravel/Symfony considered) resolved to Fastify by the shared-contract argument.
