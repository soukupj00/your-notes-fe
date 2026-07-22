# PLAN — Overall roadmap

This is the top-level roadmap for the frontend (React SPA + PWA). It tracks the original brief in [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) against current progress, and links to per-area plans. The backend sync server lives in a **separate repository**; this repo only plans the client-side of sync.

See [`CONTEXT.md`](./CONTEXT.md) for the domain glossary and [`docs/adr/`](./docs/adr/) for the decisions that shaped this plan.

## Current state (snapshot)

- ✅ Vite + React 19 + TS + Tailwind v4 + shadcn/Radix scaffolding; VitePWA configured.
- ✅ Dexie data layer (`src/db`) with Notes/Tags/NoteTags + attachment tables; seeders.
- ✅ Data-access hooks (`src/hooks/data`): live queries + CRUD + search.
- ✅ TipTap editor on the canonical Pattern A ([ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md)): marks, headings, lists/tasks, blockquote, text color + highlight, font family/size, and Mathematics (KaTeX) - each shipped with a test; live color preview and a responsive, mobile-first toolbar.
- ✅ i18n (en/cs) and light/dark theming via OKLCH tokens.
- ✅ Vitest + React Testing Library wired up (64 tests, reusing `fake-indexeddb`); legacy toolbar patterns removed.
- ✅ Real notes home (M2): masonry list, create bar + mobile quick-capture, `NoteEditorDialog` with debounced autosave, delete + undo, search over body.
- ✅ M2.5 polish: feed layout toggle (masonry ↔ list, persisted), mobile capture bar (note + checklist) with checklist smart-init, sticky-bottom mobile editor toolbar, local "Saved" autosave indicator.
- ⏸️ Playwright E2E deferred (resource-heavy; UI tested manually).
- ✅ M3 Slice 1: inline images end to end (custom `imageAttachment` node + Dexie-backed `attachments` table, cascade delete/undo, orphan GC).
- ✅ M3 Slice 2: inline audio end to end (custom `audioAttachment` node reusing the Slice 1 `attachments/` core, mic recording via `useAudioRecorder`/`MediaRecorder`, custom player NodeView, home-card chip with autoplay-on-open).
  Video/File/Excalidraw and image/audio processing (thumbnails, waveform) deferred to later M3 sub-slices.
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

### M1 — Test foundation + editor extensions  ✅ done
- [x] Install & configure **Vitest** + **React Testing Library** (reusing `fake-indexeddb`); add `test` script. **Playwright** `test:e2e` deferred (resource-heavy; UI tested manually).
- [x] Consolidate duplicate case-variant extension folders (`History/`↔`history/`, `Color/`↔`text-color/`).
- [x] Standardize on the canonical toolbar pattern (extension-owned `button` + icon registry — [ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md)); migrated `FormatSection`/`ListSection` (+ `Heading`/`Blocks`/`Font` sections); legacy toolbars removed.
- [x] Flesh out each editor extension and register it in `editor.tsx` (marks, headings, lists/tasks, blockquote, color/highlight, fonts, Mathematics); responsive mobile-hide mechanism (`hideOnMobile`).
- [x] Write a test per extension (64 tests total).
- Deferred to M3: media extensions (Image/Video/Attachment) + Excalidraw - blocked on attachment storage (`src/db/PLAN.md`).
- Detail: [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md).

### M2 — Real notes CRUD UI  ✅ done
- Replaced the `App.tsx` demo with the note list + create/edit flow, wiring `NoteCard` / `NoteContent` / `NotesHome` / `NoteEditorDialog` to the data hooks. Mobile-first, offline-first usable. Landed with tests (card click/keyboard, dialog autosave/draft/discard, delete/restore, search-by-body).

### M2.5 — Notes UX polish  ✅ done
Keep-simple friction-reducers layered on M2 (detailed slice plan lived in a planning session, not the repo):
- [x] Feed layout toggle (masonry ↔ single-column list), persisted to localStorage via `ViewModeProvider`.
- [x] Mobile quick-capture bar (note + checklist) replacing the FAB; checklist smart-init opens the editor with an empty task list ready + focused. Mobile search moved to the top bar.
- [x] Sticky-bottom mobile editor toolbar (rides above the keyboard via `interactive-widget=resizes-content`); desktop unchanged.
- [x] Local "Saved" autosave indicator (icon-only) in the editor; designed to extend to Syncing/Offline in M5.
- Deferred: photo/mic capture + audio → M3; slash commands + real VirtualKeyboard docking → M4; full cloud sync-states → M5. Dropped: block drag handles, customizable toolbars.

### M3 — Attachments & rich media
- Images, audio, video, files, and Excalidraw drawings end to end: extension → Dexie storage → render. See [`src/db/PLAN.md`](./src/db/PLAN.md) for storage strategy.
- ✅ **Slice 1 - inline images end to end + storage foundation**: generic `attachments` Dexie table (blob-backed, not per-kind); `useAttachmentActions` (create/get/delete/clone, note-scoped GC, global orphan safety net); cascade delete/undo carries attachments with the note; custom `imageAttachment` TipTap node (`attachmentId`-only, no persisted `src`) with a React NodeView resolving to an object URL; paste/drop/toolbar insertion pipeline with validation and cross-note dedupe (`cloneAttachment`); `NoteBody` renders images on the home card; global GC sweep wired at `NotesHome` mount.
- ✅ **Slice 2 - inline audio end to end**: extracted the Slice 1 node/insertion logic into a media-agnostic `extensions/attachments/` core (`createAttachmentNode`, `useAttachmentObjectUrl`, shared `insert.ts`/`deps.ts`) and rebuilt `Image` on top of it with no behavior change; custom `audioAttachment` node (body `<audio data-attachment-id>`, no `src`) reusing that core; `AudioNodeView` custom player (play/pause, scrubber, elapsed/duration) over a hidden native `<audio>`; mic recording via `useAudioRecorder` (a `MediaRecorder` state machine handling permission prompts, cancel, and error paths with guaranteed mic release) behind `AudioRecordButton`; file attach via picker/paste/drop through the shared insertion pipeline; `attachments` rows carry `kind: 'audio'` + `duration`; `NoteBody` renders a compact chip (not a full player) for audio on the home card, and `NoteCard` opens the note with autoplay intent when that chip is clicked.
- Deferred sub-slices (build on the Slice 1/2 `attachments/` core): image/audio processing (re-compression + thumbnails, waveform/level-meter via `wavesurfer.js`); mobile quick-capture-bar photo/mic buttons (unified capture bar, once all media types exist); image resize/alignment controls; recording trim/edit + playback speed; video, file, and Excalidraw attachments (each adds a node + `kind`, reusing `useAttachmentActions`, the shared `attachments/` core, and `NoteBody`); startup GC sweep for crash/hard-close orphans (carried forward from Slice 1).

### M4 — Accessibility & polish
- Color-blindness / low-vision theme variants, descriptive icons, full i18n coverage, optional Motion/GSAP animations.

### M5 — Sync (client-side)
- Local-account/auth context, REST/HATEOAS API client, response caching, offline mutation queue, conflict resolution against Dexie. Backend lives in the separate repo.

## Per-area plans

- [`src/db/PLAN.md`](./src/db/PLAN.md) — schema versioning, attachment storage, sync metadata.
- [`src/hooks/data/PLAN.md`](./src/hooks/data/PLAN.md) — attachment actions, optimistic updates, mutation queue.
- [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md) — M1 extension work in detail.
- [`src/context/PLAN.md`](./src/context/PLAN.md) — auth context, accessibility themes.
