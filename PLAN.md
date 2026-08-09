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
- ✅ M3 Slice 3: inline video end to end (`videoAttachment` node on the shared core, native `<video controls>` NodeView, home-card play button coexisting with the audio button).
- ✅ M3 Slice 3.5: confirm-before-delete retrofit (shared `ConfirmDeleteButton`, wired onto Image/Audio/Video).
- ✅ M3 Slice 4: generic file attachments end to end (`fileAttachment` node on the shared core, toolbar-picker-only insertion with no MIME whitelist, filename + generic icon + open/download NodeView, home-card file button coexisting with audio/video). Paste/drop, content preview/thumbnails, and metadata beyond the filename are deferred (no MIME prefix to disambiguate `file` in the shared paste/drop router).
  Excalidraw and image/audio/video processing (thumbnails, waveform) deferred to later M3 sub-slices.
- ❌ No sync, no accounts, no accessibility themes, no animations.

## Milestones

### M0 — Tooling & CI/CD  (prerequisite)  ✅ done
Decisions: [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md) (Biome), [ADR 0006](./docs/adr/0006-ci-cd-and-container-image-distribution.md) (pipeline). Retro plan: [`docs/superpowers/plans/2026-06-17-m0-slice1-tooling-and-cicd.md`](./docs/superpowers/plans/2026-06-17-m0-slice1-tooling-and-cicd.md).

- **Migrate to Biome** (replaces ESLint + Prettier):
  - Add `biome.json` (recommended rules + `organizeImports` + formatter; nursery `useSortedClasses` configured for `className`/`cn`/`clsx`/`cva`).
  - Remove `eslint*` + `prettier*` deps, `eslint.config.ts`, and Prettier configs.
  - Add scripts `check` (`biome check --write`), `check:ci` (`biome ci .`), `format`; drop `lint`.
  - Repoint `lint-staged` to `biome check --write --no-errors-on-unmatched` (apply safe fixes + re-stage; block on the rest). Keep husky `pre-commit`.
- **Pin the toolchain:** add `packageManager: "pnpm@<lockfile-version>"` + `.nvmrc` (Node 22); change `Dockerfile` from `npm i -g pnpm` to `corepack enable` + `pnpm install --frozen-lockfile`.
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
Retro plan: [`docs/superpowers/plans/2026-07-21-m2-slice1-notes-crud-ui.md`](./docs/superpowers/plans/2026-07-21-m2-slice1-notes-crud-ui.md).
- Replaced the `App.tsx` demo with the note list + create/edit flow, wiring `NoteCard` / `NoteContent` / `NotesHome` / `NoteEditorDialog` to the data hooks. Mobile-first, offline-first usable. Landed with tests (card click/keyboard, dialog autosave/draft/discard, delete/restore, search-by-body).

### M2.5 — Notes UX polish  ✅ done
Keep-simple friction-reducers layered on M2. Retro plan: [`docs/superpowers/plans/2026-07-21-m2.5-slice1-ux-polish.md`](./docs/superpowers/plans/2026-07-21-m2.5-slice1-ux-polish.md).
- [x] Feed layout toggle (masonry ↔ single-column list), persisted to localStorage via `ViewModeProvider`.
- [x] Mobile quick-capture bar (note + checklist) replacing the FAB; checklist smart-init opens the editor with an empty task list ready + focused. Mobile search moved to the top bar.
- [x] Sticky-bottom mobile editor toolbar (rides above the keyboard via `interactive-widget=resizes-content`); desktop unchanged.
- [x] Local "Saved" autosave indicator (icon-only) in the editor; designed to extend to Syncing/Offline in M5.
- Deferred: photo/mic capture + audio → M3; slash commands + real VirtualKeyboard docking → M4; full cloud sync-states → M5. Dropped: block drag handles, customizable toolbars.

### M3 — Attachments & rich media
- Images, audio, video, files, and Excalidraw drawings end to end: extension → Dexie storage → render. See [`src/db/PLAN.md`](./src/db/PLAN.md) for storage strategy.
- ✅ **Slice 1 - inline images end to end + storage foundation**: generic `attachments` Dexie table (blob-backed, not per-kind); `useAttachmentActions` (create/get/delete/clone, note-scoped GC, global orphan safety net); cascade delete/undo carries attachments with the note; custom `imageAttachment` TipTap node (`attachmentId`-only, no persisted `src`) with a React NodeView resolving to an object URL; paste/drop/toolbar insertion pipeline with validation and cross-note dedupe (`cloneAttachment`); `NoteBody` renders images on the home card; global GC sweep wired at `NotesHome` mount.
- ✅ **Slice 2 - inline audio end to end**: extracted the Slice 1 node/insertion logic into a media-agnostic `extensions/attachments/` core (`createAttachmentNode`, `useAttachmentObjectUrl`, shared `insert.ts`/`deps.ts`) and rebuilt `Image` on top of it with no behavior change; custom `audioAttachment` node (body `<audio data-attachment-id>`, no `src`) reusing that core; `AudioNodeView` custom player (play/pause, scrubber, elapsed/duration) over a hidden native `<audio>`; mic recording via `useAudioRecorder` (a `MediaRecorder` state machine handling permission prompts, cancel, and error paths with guaranteed mic release) behind `AudioRecordButton`; file attach via picker/paste/drop through the shared insertion pipeline; `attachments` rows carry `kind: 'audio'` + `duration`; `NoteBody` renders a compact chip (not a full player) for audio on the home card, and `NoteCard` opens the note with autoplay intent when that chip is clicked.
- ✅ **Slice 3 - inline video end to end**: `videoAttachment` node built on the same `attachments/` core (mirrors audio's node/insertion wiring); `VideoNodeView` uses a native `<video controls playsInline>` (no custom player skin needed); delete button on the node (`props.deleteNode()`, no confirmation yet); home card gets a pinned video play button next to the audio one (`NoteCard`'s bottom-right control is now a flex row, not a single button).
- ✅ **Slice 3.5 - confirm-before-delete retrofit** (plan: [`docs/superpowers/plans/2026-07-23-m3-slice3.5-delete-confirm.md`](./docs/superpowers/plans/2026-07-23-m3-slice3.5-delete-confirm.md)): one shared confirm dialog (`ConfirmDeleteButton`), wired onto Audio's and Video's existing delete buttons and added to Image. Node deletion stays editor-only (no Dexie write); the existing deferred-GC behavior (`collectOrphans` at `NoteEditorDialog` close) already defers the actual blob delete until the user leaves the note. File and Excalidraw (Slices 4-5) consume this shared component from day one instead of copying the bare `deleteNode()` pattern.
- ✅ **Slice 4 - generic file attachments** (plan: [`docs/superpowers/plans/2026-07-23-m3-slice4-file-attachments.md`](./docs/superpowers/plans/2026-07-23-m3-slice4-file-attachments.md)): a `fileAttachment` node/kind for arbitrary files (PDF and others) on the same `attachments/` core; toolbar-picker-only insertion (no MIME whitelist, size cap only - paste/drop deferred, since `file` has no MIME prefix to disambiguate from media in the shared router); the home card shows a generic file icon only (no thumbnail - too heavy to render a PDF first page just to signal "there's a file here"); delete button reuses the Slice 3.5 confirm component.
- ✅ **Slice 5 - Excalidraw attachments** (plan: [`docs/superpowers/plans/2026-07-23-m3-slice5-excalidraw.md`](./docs/superpowers/plans/2026-07-23-m3-slice5-excalidraw.md)): embeds the Excalidraw canvas as its own node (not a picked file - a created/edited scene); JSON scene + rendered SVG snapshot stored via the `attachments` core (`kind: 'excalidraw'`); card shows the SVG snapshot; delete reuses the Slice 3.5 confirm component. Architecturally distinct from Slices 1-4 (embeds an editor, not just an attach-existing-blob flow), so it stays its own slice rather than folding into Slice 4. Phase 1 (inline canvas) did not work (missing CSS import + the canvas fighting `contentEditable`); **Phase 2 (shipped)** reworked the editing surface into a shared modal (`ExcalidrawDialog`) with a passive live-queried SVG preview node (commit-on-Save; guarded Save/Cancel/Delete).
- ✅ **Slice 6 - performance & polish closeout** (plan: [`docs/superpowers/plans/2026-07-24-m3-slice6-perf-polish-closeout.md`](./docs/superpowers/plans/2026-07-24-m3-slice6-perf-polish-closeout.md)): the perf + correctness work that finishes M3, plus a bounded set of named polish fixes. Six small tasks: (1) **image thumbnails** for the card feed (new `Attachment.thumbnail?: Blob`, no migration; WebP <=512px generated at insert; card falls back to the full blob when absent) + a `CONTEXT.md` **Preview** glossary entry; (2) **comprehensive startup GC sweep** (per-note reference reconciliation at `NotesHome` mount, closing the crash/hard-close orphan leak); (3) **unify the delete button** placement/prominence (corner overlay for image/video/file, inline-trailing for audio, all via the shared `ConfirmDeleteButton`); (4) **audio recording UI** - full-width on mobile + a calmer scrolling amplitude-bar visualizer (replacing the jumpy oscilloscope); (5) **Excalidraw card preview rounded corners** (card path in `NoteBody`); (6) **harden autoplay-on-open**. Closes M3.
- Deferred to M4 (earmarked, not dismissed): **video poster thumbnails** (the one useful media preview beyond images, but heavier + a new inline card preview); mobile quick-capture-bar photo/mic buttons (unified capture bar); image resize/alignment controls; recording trim/edit + playback speed; audio/video waveform/level-meter as a feature (`wavesurfer.js`).

### M4 — Accessibility, polish & feature completion
The last frontend-only milestone (M5 is sync). Scoped from [`M4.md`](./M4.md) via a `/grill-with-docs` session that surfaced net-new features hiding inside "polish" (Tags had no UI, Settings was empty, the checklist was a dead field, there was no note lifecycle). Brings the app to Google-Keep parity with a distinctive, accessible, customisable identity.

Key decisions: [ADR 0008](./docs/adr/0008-tanstack-router-over-react-router.md) (TanStack Router), [ADR 0009](./docs/adr/0009-note-lifecycle-model.md) (note lifecycle model), and the `CONTEXT.md` glossary (lifecycle; checklist redefined as a body task list; tag colour). New deps: `@tanstack/react-router`, `fuse.js`, `fflate`, `motion`, `react-hotkeys-hook`, `driver.js`, `@tiptap/extension-text-align`, `@dnd-kit/*`. One Dexie bump (lifecycle fields + `Tag.color`, remove dead `checklist`; no migration).

Five slices, each a checkable plan doc:
- **Slice 1 — Foundations** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice1-foundations.md)): lifecycle data model + actions/purge/undo, TanStack Router + nav shell, Dexie-backed `PreferencesProvider`, Tags end-to-end, zip export/import.
- **Slice 2 — Search & capture** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice2-search-and-capture.md)): Fuse.js fuzzy search, sort + AND tag-pill filters in typed URL params, Keep-style creation speed-dial with auto-capture.
- **Slice 3 — Polish sweep** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice3-polish-sweep.md)): hover states, missing colour tokens, de-purple, skeletons/empty states, semantics + tab order + error boundary, `mod+K`, editor nodes (Link/HR/code/text-align/code-block) + slash menu.
- **Slice 4 — Identity & motion** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice4-identity-and-motion.md)): "tactile paper" redesign (prototype-first), Motion animations, full-card colour system, data-driven customisable toolbar, checklist polish, complete Settings.
- **Slice 5 — Onboarding** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice5-onboarding.md), [ADR 0015](./docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)): a five-step Tour that *drives* the app rather than describing it, demonstrating on disposable Props it creates and purges; `driver.js` for the spotlight with React portalled into its popover; first-load + Settings replay; wires Playwright.

Deferred to pre-release/M5: `navigator.storage.persist()`; single-key power shortcuts + `?` cheat sheet; merge-style import.

### M5 — Sync (client-side)
- Local-account/auth context, REST/HATEOAS API client, response caching, offline mutation queue, conflict resolution against Dexie. Backend lives in the separate repo.

## Per-area plans

- [`src/db/PLAN.md`](./src/db/PLAN.md) — schema versioning, attachment storage, sync metadata.
- [`src/hooks/data/PLAN.md`](./src/hooks/data/PLAN.md) — attachment actions, optimistic updates, mutation queue.
- [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md) — M1 extension work in detail.
- [`src/context/PLAN.md`](./src/context/PLAN.md) — auth context, accessibility themes.
