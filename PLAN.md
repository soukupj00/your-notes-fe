# PLAN — Overall roadmap

This is the top-level roadmap for the frontend (React SPA + PWA). It tracks the original brief in [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) against current progress, and links to per-area plans. The backend sync server lives in a **separate repository**; this repo only plans the client-side of sync.

See [`CONTEXT.md`](./CONTEXT.md) for the domain glossary and [`docs/adr/`](./docs/adr/) for the decisions that shaped this plan.

## Current state (snapshot)

- ✅ Vite + React 19 + TS + Tailwind v4 + shadcn/Radix scaffolding; VitePWA configured.
- ✅ Dexie data layer (`src/db`) with Notes/Tags/NoteTags + attachment tables; seeders.
- ✅ Data-access hooks (`src/hooks/data`): live queries + CRUD + search.
- ✅ TipTap editor on the canonical Pattern A ([ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md)): marks, headings, lists/tasks, blockquote, text color + highlight, font family/size, and Mathematics (KaTeX) - each shipped with a test; live color preview and a responsive, mobile-first toolbar.
- ✅ i18n (en/cs) and light/dark theming via OKLCH tokens.
- ✅ Vitest + React Testing Library (907 tests across 131 files, reusing `fake-indexeddb`); legacy toolbar patterns removed.
- ✅ Real notes home (M2): masonry list, create bar + mobile quick-capture, `NoteEditorDialog` with debounced autosave, delete + undo, search over body.
- ✅ M2.5 polish: feed layout toggle (masonry ↔ list, persisted), mobile capture bar (note + checklist) with checklist smart-init, sticky-bottom mobile editor toolbar, local "Saved" autosave indicator.
- ✅ Playwright wired in M4 slice 5 (`e2e/`, `desktop` + `mobile` projects, a CI job in the `test` stage). It was deferred through M1-M3; the Tour is what needed it, since jsdom measures every element as 0x0 and can see nothing a spotlight does.
- ✅ M3 Slice 1: inline images end to end (custom `imageAttachment` node + Dexie-backed `attachments` table, cascade delete/undo, orphan GC).
- ✅ M3 Slice 2: inline audio end to end (custom `audioAttachment` node reusing the Slice 1 `attachments/` core, mic recording via `useAudioRecorder`/`MediaRecorder`, custom player NodeView, home-card chip with autoplay-on-open).
- ✅ M3 Slice 3: inline video end to end (`videoAttachment` node on the shared core, native `<video controls>` NodeView, home-card play button coexisting with the audio button).
- ✅ M3 Slice 3.5: confirm-before-delete retrofit (shared `ConfirmDeleteButton`, wired onto Image/Audio/Video).
- ✅ M3 Slice 4: generic file attachments end to end (`fileAttachment` node on the shared core, toolbar-picker-only insertion with no MIME whitelist, filename + generic icon + open/download NodeView, home-card file button coexisting with audio/video). Paste/drop, content preview/thumbnails, and metadata beyond the filename are deferred (no MIME prefix to disambiguate `file` in the shared paste/drop router).
  Excalidraw and image/audio/video processing (thumbnails, waveform) deferred to later M3 sub-slices.
- ✅ M4 complete: TanStack Router + sidebar shell, note lifecycle, tags/labels, zip backup, fuzzy search in the URL, the `nightshift` identity with Motion, a customisable toolbar, full Settings, and the Tour.
  Accessibility themes shipped as the colour-blind palette, density and reduced motion (`DocumentPreferences`); high-contrast/low-vision is still open (`src/context/PLAN.md`).
- ✅ Storage persistence requested on the user's first saved note (`src/lib/persistentStorage.ts`); reporting the answer waits for M5's storage/sync section.
- ❌ No sync, no accounts.

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
- Images, audio, video, files, and Excalidraw drawings end to end: extension → Dexie storage → render. See [`src/data/PLAN.md`](./src/data/PLAN.md) for storage strategy.
- ✅ **Slice 1 - inline images end to end + storage foundation**: generic `attachments` Dexie table (blob-backed, not per-kind); `useAttachmentActions` (create/get/delete/clone, note-scoped GC, global orphan safety net); cascade delete/undo carries attachments with the note; custom `imageAttachment` TipTap node (`attachmentId`-only, no persisted `src`) with a React NodeView resolving to an object URL; paste/drop/toolbar insertion pipeline with validation and cross-note dedupe (`cloneAttachment`); `NoteBody` renders images on the home card; global GC sweep wired at `NotesHome` mount.
- ✅ **Slice 2 - inline audio end to end**: extracted the Slice 1 node/insertion logic into a media-agnostic `extensions/attachments/` core (`createAttachmentNode`, `useAttachmentObjectUrl`, shared `insert.ts`/`deps.ts`) and rebuilt `Image` on top of it with no behavior change; custom `audioAttachment` node (body `<audio data-attachment-id>`, no `src`) reusing that core; `AudioNodeView` custom player (play/pause, scrubber, elapsed/duration) over a hidden native `<audio>`; mic recording via `useAudioRecorder` (a `MediaRecorder` state machine handling permission prompts, cancel, and error paths with guaranteed mic release) behind `AudioRecordButton`; file attach via picker/paste/drop through the shared insertion pipeline; `attachments` rows carry `kind: 'audio'` + `duration`; `NoteBody` renders a compact chip (not a full player) for audio on the home card, and `NoteCard` opens the note with autoplay intent when that chip is clicked.
- ✅ **Slice 3 - inline video end to end**: `videoAttachment` node built on the same `attachments/` core (mirrors audio's node/insertion wiring); `VideoNodeView` uses a native `<video controls playsInline>` (no custom player skin needed); delete button on the node (`props.deleteNode()`, no confirmation yet); home card gets a pinned video play button next to the audio one (`NoteCard`'s bottom-right control is now a flex row, not a single button).
- ✅ **Slice 3.5 - confirm-before-delete retrofit** (plan: [`docs/superpowers/plans/2026-07-23-m3-slice3.5-delete-confirm.md`](./docs/superpowers/plans/2026-07-23-m3-slice3.5-delete-confirm.md)): one shared confirm dialog (`ConfirmDeleteButton`), wired onto Audio's and Video's existing delete buttons and added to Image. Node deletion stays editor-only (no Dexie write); the existing deferred-GC behavior (`collectOrphans` at `NoteEditorDialog` close) already defers the actual blob delete until the user leaves the note. File and Excalidraw (Slices 4-5) consume this shared component from day one instead of copying the bare `deleteNode()` pattern.
- ✅ **Slice 4 - generic file attachments** (plan: [`docs/superpowers/plans/2026-07-23-m3-slice4-file-attachments.md`](./docs/superpowers/plans/2026-07-23-m3-slice4-file-attachments.md)): a `fileAttachment` node/kind for arbitrary files (PDF and others) on the same `attachments/` core; toolbar-picker-only insertion (no MIME whitelist, size cap only - paste/drop deferred, since `file` has no MIME prefix to disambiguate from media in the shared router); the home card shows a generic file icon only (no thumbnail - too heavy to render a PDF first page just to signal "there's a file here"); delete button reuses the Slice 3.5 confirm component.
- ✅ **Slice 5 - Excalidraw attachments** (plan: [`docs/superpowers/plans/2026-07-23-m3-slice5-excalidraw.md`](./docs/superpowers/plans/2026-07-23-m3-slice5-excalidraw.md)): embeds the Excalidraw canvas as its own node (not a picked file - a created/edited scene); JSON scene + rendered SVG snapshot stored via the `attachments` core (`kind: 'excalidraw'`); card shows the SVG snapshot; delete reuses the Slice 3.5 confirm component. Architecturally distinct from Slices 1-4 (embeds an editor, not just an attach-existing-blob flow), so it stays its own slice rather than folding into Slice 4. Phase 1 (inline canvas) did not work (missing CSS import + the canvas fighting `contentEditable`); **Phase 2 (shipped)** reworked the editing surface into a shared modal (`ExcalidrawDialog`) with a passive live-queried SVG preview node (commit-on-Save; guarded Save/Cancel/Delete).
- ✅ **Slice 6 - performance & polish closeout** (plan: [`docs/superpowers/plans/2026-07-24-m3-slice6-perf-polish-closeout.md`](./docs/superpowers/plans/2026-07-24-m3-slice6-perf-polish-closeout.md)): the perf + correctness work that finishes M3, plus a bounded set of named polish fixes. Six small tasks: (1) **image thumbnails** for the card feed (new `Attachment.thumbnail?: Blob`, no migration; WebP <=512px generated at insert; card falls back to the full blob when absent) + a `CONTEXT.md` **Preview** glossary entry; (2) **comprehensive startup GC sweep** (per-note reference reconciliation at `NotesHome` mount, closing the crash/hard-close orphan leak); (3) **unify the delete button** placement/prominence (corner overlay for image/video/file, inline-trailing for audio, all via the shared `ConfirmDeleteButton`); (4) **audio recording UI** - full-width on mobile + a calmer scrolling amplitude-bar visualizer (replacing the jumpy oscilloscope); (5) **Excalidraw card preview rounded corners** (card path in `NoteBody`); (6) **harden autoplay-on-open**. Closes M3.
- Deferred to M4 (earmarked, not dismissed): **video poster thumbnails** (the one useful media preview beyond images, but heavier + a new inline card preview); mobile quick-capture-bar photo/mic buttons (unified capture bar); image resize/alignment controls; recording trim/edit + playback speed; audio/video waveform/level-meter as a feature (`wavesurfer.js`).

### M4 — Accessibility, polish & feature completion  ✅ done
The last frontend-only milestone (M5 is sync). Scoped from [`M4.md`](./M4.md) via a `/grill-with-docs` session that surfaced net-new features hiding inside "polish" (Tags had no UI, Settings was empty, the checklist was a dead field, there was no note lifecycle). Brings the app to Google-Keep parity with a distinctive, accessible, customisable identity.

Key decisions: [ADR 0008](./docs/adr/0008-tanstack-router-over-react-router.md) (TanStack Router), [ADR 0009](./docs/adr/0009-note-lifecycle-model.md) (note lifecycle model), and the `CONTEXT.md` glossary (lifecycle; checklist redefined as a body task list; tag colour). New deps: `@tanstack/react-router`, `fuse.js`, `fflate`, `motion`, `react-hotkeys-hook`, `driver.js`, `@tiptap/extension-text-align`, `@dnd-kit/*`. One Dexie bump (lifecycle fields + `Tag.color`, remove dead `checklist`; no migration).

Five slices (six plan docs - 2.5 was scoped mid-milestone), each a checkable plan doc:
- ✅ **Slice 1 — Foundations** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice1-foundations.md)): lifecycle data model + actions/purge/undo, TanStack Router + nav shell, Dexie-backed `PreferencesProvider`, Tags end-to-end, zip export/import.
- ✅ **Slice 2 — Search & capture** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice2-search-and-capture.md)): Fuse.js fuzzy search, sort + AND tag-pill filters in typed URL params, Keep-style creation speed-dial with auto-capture.
- ✅ **Slice 2.5 — Sidebar nav shell** ([plan](./docs/superpowers/plans/2026-07-29-m4-slice2.5-sidebar-nav-shell.md), [ADR 0010](./docs/adr/0010-shadcn-sidebar-as-nav-shell.md)): the vendored shadcn `Sidebar` as the app shell - a full-height icon-collapsible rail from `sm:`, the same content in a drawer below it.
- ✅ **Slice 3 — Polish sweep** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice3-polish-sweep.md)): hover states, missing colour tokens, de-purple, skeletons/empty states, semantics + tab order + error boundary, `mod+K`, editor nodes (Link/HR/code/text-align/code-block) + slash menu.
- ✅ **Slice 4 — Identity & motion** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice4-identity-and-motion.md), plus [task 5](./docs/superpowers/plans/2026-08-03-m4-slice4-task5-customisable-toolbar.md), [task 5c](./docs/superpowers/plans/2026-08-07-m4-slice4-task5c-live-checklists-and-held-rank.md), [task 7](./docs/superpowers/plans/2026-08-08-m4-slice4-task7-mobile-topbar-and-back.md)): the `nightshift` redesign ([DESIGN.md](./DESIGN.md)), Motion animations, full-card colour system, data-driven customisable toolbar, checklist polish, complete Settings, mobile topbar + back.
- ✅ **Slice 5 — Onboarding** ([plan](./docs/superpowers/plans/2026-07-25-m4-slice5-onboarding.md), plus [task 7 - timing](./docs/superpowers/plans/2026-08-10-m4-slice5-task7-tour-timing.md), [ADR 0015](./docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)): a six-step Tour that *drives* the app rather than describing it, demonstrating on disposable Props it creates and purges; `driver.js` for the spotlight with React portalled into its popover; first-load + Settings replay; wires Playwright.

Deferred to pre-release/M5: single-key power shortcuts + `?` cheat sheet; the Settings storage row (see M5).
Merge-style import is no longer deferred: it is subsumed by **Import from other apps** ([design](./docs/superpowers/specs/2026-08-21-m5-import-from-other-apps-design.md), [ADR 0019](./docs/adr/0019-import-replaces-restore.md)) - one additive Import replacing Restore, with Google Keep and Obsidian as the first foreign Sources.
Named remainders inside the slice-4 plans rather than dropped: a touch-target audit of the production surfaces, the Motion contract on the speed-dial and tag-filter pills, and keyboard shortcuts for the toolbar actions that have none (task 5's step 4c, which needs sign-off on the bindings rather than code).
`navigator.storage.persist()` is no longer deferred - it landed in this closeout.

### M5 — Sync

The first milestone that spans both repositories. The backend repo (`ni-dip-be`) is empty at the start of it, so M5 is "design a protocol, build a server, build the client half", not "wire up sync".

Scoped by a `/grill-with-docs` session on 2026-08-12. Key decisions: [ADR 0017](./docs/adr/0017-note-level-last-writer-wins-with-conflicted-copies.md) (conflict model) and [ADR 0018](./docs/adr/0018-the-server-serves-the-pwa.md) (the server serves the PWA, and what that forces about auth, pairing and TLS). New glossary: Revision, Conflicted Copy, Tombstone, Owner, Invite, Device; the Offline Mutation Queue was **redefined** from an ordered intent log to a set.

**The stack**, decided together because each choice constrained the next:

- **Server:** TypeScript + Fastify + SQLite (`better-sqlite3`) + Drizzle, in one container with Caddy for TLS. TypeScript because it makes the wire contract one shared Zod file instead of two definitions that drift; SQLite because a self-hoster's backup should be "copy one file".
- **API:** REST with **HAL** (`application/hal+json`) for the brief's HATEOAS requirement. The sync feed is a hypermedia collection - a device stores the opaque `_links.next` URL as its cursor and never builds a query string. Response caching is `ETag` on change pages, which are immutable once complete.
- **Change detection:** an SSE hint channel for Live Update (event `id` = the Account's change sequence, never data), with polling on focus/`online`/visibility as the Catch-up trigger and the fallback while the stream is down. Re-evaluated 2026-08-30 against a wider candidate set ([`docs/notes.md`](./docs/notes.md)); a stale push gets a `conflict` outcome for that row.
- **Contract:** owned by the backend repo, vendored here as one committed file via `pnpm contract:pull`; every response validated with Zod at the boundary, which doubles as the drift alarm.
- **Attachments:** bytes are write-once by id, so transfer is an idempotent `PUT`. Previews sync eagerly (tens of KB - the feed is instantly correct), full bytes on demand, with a "keep everything on this device" preference. Known ceilings: no resumable upload, no per-account quota.
- **Client:** the sync loop runs on the main thread in a `SyncProvider` that reads and writes the `LocalStore` and talks to a `Remote` ([ADR 0020](./docs/adr/0020-the-local-store-seam.md)); it never touches Dexie. Ceiling: move to a Worker if a large first pull janks the UI.

**Six slices.** Slice 1 is this repo alone and comes first because every later slice consumes its seam; slice 2 is backend alone; the rest interleave:

1. **The Local Store seam** *(here)* — [ADR 0020](./docs/adr/0020-the-local-store-seam.md), [plan](./docs/superpowers/plans/2026-08-29-m5-slice1-local-store-seam.md). One `LocalStore` interface every read and write goes through, a Dexie implementation (default) and an in-memory one under one contract test suite, `Live<T>` + `useLive` replacing `useLiveQuery`, Preferences moved to `localStorage`, Dexie fenced by Biome, and the `Remote`/`AccountService` types declared. A pure refactor: no schema bump, no UI change.
2. **Server skeleton** *(backend)* — Fastify + Drizzle + SQLite, the Zod contract with OpenAPI falling out of it, HAL serializer, sessions + first-run Owner + Invites, `compose.yml` with Caddy, `@fastify/static` serving the built PWA.
3. ✅ **Client foundations** *(here)* ([plan](./docs/superpowers/plans/2026-09-28-m5-slice3-client-foundations.md)) — Dexie bump (`rev`, dirty marker, `tombstones`) in both Local Store implementations with the dirty-row query added to the contract, the write-once Excalidraw refactor, `SyncProvider` (against `LocalStore` + `Remote`) + account context, the HAL `Remote` and `AccountService` implementations, boundary validation, and the Settings **Account** section (sign in/out, Devices with revoke) beside the storage row carried over from M4.
   Deviations: `SyncProvider` moved to slice 4, where the loop it would run lands; sign out does not yet erase (slice 4); `/pair` and the Pairing Link QRs landed here rather than in slice 6.
4. ✅ **The loop** *(both)* ([plan](./docs/superpowers/plans/2026-09-28-m5-slice4-sync-loop.md)) — `GET /changes` with cursor links and ETags, the SSE hint endpoint and the optional `hints` method on `Remote`, dirty push with Revisions, outcomes per row, conflict → Conflicted Copy + "Conflicts" tag + toast, adopt-on-first-sign-in, erase-on-sign-out, and the too-old-cursor full resync.
   Deviations: a Tag conflict keeps the server's Tag and copies nothing; pulled Attachment metadata waits for slice 5; the Settings storage row (carried in from M4) landed here beside the sync status.
   Two feed fixes came out of it, in the backend since `7c842e6`: every page carries `_links.resume`, the cursor a caught-up Device keeps, and every `next` carries the pull's origin (`from`), so a full resync pages past swept Tombstones.
5. ✅ **Attachments** *(both)* ([plan](./docs/superpowers/plans/2026-09-28-m5-slice5-attachments.md)) — idempotent byte upload/download, eager thumbnails, the new "known but not downloaded" attachment node state, the keep-everything preference.
   Deviations: the vendored contract carries the backend's `thumbnailId` line ahead of a `contract:pull`, because the HAL client's Zod parse drops keys it does not know; video posters get a `thumbnailId` too, not only image thumbnails; an image too small to have a thumbnail is fetched eagerly as its own Preview; a transfer that finds nothing yet (the other Device uploads after its push, so its hint arrives first) keeps the loop's back-off running.
6. **Setup, docs, testing** *(both)* — the three Caddy modes with one documented happy path, first-run and Invite UX, sync status polish, and the user testing the brief requires.

✅ **Share Links** *(both; backend slice B6, after the loop)* ([plan](./docs/superpowers/plans/2026-09-28-m5-share-links.md)): a Share button in the Note's bar with a dialog to copy or end the link, `/share/$token` as a read-only page for anyone who can reach the server, and a "Shared Notes" list in Settings.
Deviations: `sharedBlobUrl` takes the fetched page rather than the token, because the blob template lives on the page; the public page's own address is written by hand, because the HAL root does not list it; the page renders outside the app shell and runs on an in-memory Local Store, so a stranger's browser never opens IndexedDB.

**Testing:** the client sync engine is tested here against a fake server built from the vendored contract, so conflict, resync and offline paths are deterministic. The backend tests itself in its own repo. Genuine two-device end-to-end is a manual and user-testing activity - a cross-repo Playwright pipeline would cost more than it catches.

- **Carried in from M4:** a storage row in Settings reporting `navigator.storage.persisted()` and `estimate()`.
  The *request* landed in M4 (`src/lib/persistentStorage.ts`, fired on the user's first saved note - Firefox prompts, so it may not land during the Tour).
  Reporting the answer waits for M5 because this milestone gives that same area a sync status (last synced, queued changes, this device's account), and "is my data safe here" is one question best answered in one block.
- **Out of scope, deliberately:** end-to-end encryption (threat model documented instead - see ADR 0018), sharing a Note between Accounts, and any email/SMTP.
- **Known gaps:**
  - `src/components/editor/editor.tsx` came back under the 500-line limit in the comment cleanup (457 lines); `src/context/TourProvider.tsx` is the one file over it now (506), which M6 slice 6 trims.

✅ **Fixes from the backend rework's end-to-end run (2026-10-01)** ([plan](./docs/superpowers/plans/2026-10-01-pwa-offline-session-a11y-fixes.md)).
Deviations: the font runtime route is limited to `/assets/`; the Card's open button is an invisible full-size button, not `sr-only`; the crash heading takes focus on mount.

### M6 - Refactor: fewer copies, same style

Scoped by a `/grill-with-docs` session on 2026-10-02 from four read-only surveys of the code ([survey](./docs/superpowers/plans/2026-10-02-refactor-survey.md)).
Decision: [ADR 0022](./docs/adr/0022-interfaces-and-closures-not-classes.md) - the patterns are applied in the codebase's existing interface-plus-closure style, no classes or decorators.
New glossary: **Intent** (the one-shot half of opening a Note) and **Draft** (the Editor's working copy for the life of one open).
Every slice is behaviour-preserving under the existing tests; a bug a slice fixes by construction rides with it and gets a pinning test, every other bug found is a ticket (below).
Each slice branches from `main` as `refactor/<slice>`, merges before the next starts, gets its own task-level plan in `docs/superpowers/plans/` when it starts, and fixes the `CLAUDE.md` and `PLAN.md` statements about the code it changes.
Near-identical tests collapse with the units they test: one table-driven test, not a copy per unit.

**Six slices, in this order** (2 and 5 build on 1):

1. ✅ **Rows** (`refactor/rows`) - `newTag`, `newNoteTag`, `newAttachment` and `cloneAttachment` beside `newNote` in one module, `crypto.randomUUID` as the single id minter (the `uuid` dependency goes; ADR 0018 already makes a secure context a requirement), runtime lists `NOTE_STATES` and `REMINDER_REPEATS` in `models.ts` with the copies in `reminder.ts` and `backup.ts` importing them and one test pinning the vendored contract's enums to them, `tags.update(id, change)` on the Local Store so `updateTag` stops being a non-atomic get-then-put, and the `conflictedCopy` rows built through the factories.
   Harmless change: a Conflicted Copy's attachments get fresh timestamps, which nothing reads.
   Deviations: `updateAttachment`'s new `thumbnailId` also moved to `mintId` (the plan missed that call); the "unknown tag" hook test already existed, so only the whitespace case was added; a Conflicted Copy's attachment clones take the conflict's timestamp and `newNote` copies only declared fields, so a field a loose restore left on a row no longer reaches the copy; the contract pin test passes a fixed clock to `reminderOf`, since a one-shot lapses a day after its time; the Conflicted Copy now fetches missing bytes and builds its clones before it writes the Note, so an interrupted fetch leaves no half copy.
2. ✅ **Editor buttons** (`refactor/editor-buttons`) - `withButton(Upstream, ctx => props)`; the eleven simple extensions (Bold, Italic, Strike, Underline, Code, CodeBlock, Blockquote, HorizontalRule, BulletList, OrderedList, TaskList) become declarations in `extensions/formatting.ts` with one table-driven test, their folders go, and Heading, TextAlign and History use the helper in place; a generic `ButtonView<C>` so the five local `XButtonView` copies and the `unknown` on `createAttachmentNode` go; the four `variant` wrapper components go; a `useLatest` hook replaces the three ref-plus-getter triples in `editor.tsx`, which fixes the microphone-error toast repeating on every keystroke.
   Deviations: ten extensions moved to `formatting.ts`, not eleven: `TaskList` keeps its folder because `ChecklistFlip` lives there, and uses `withButton` in place; `Clear` is untouched (an `Extension.create` with its own shortcut, not a wrapper); the `useLatest` getter also guards `AudioRecorderHost` itself, so the toast fix holds whatever a parent passes; nine test files outside the plan's lists imported from the deleted folders and had only their import lines repointed; `useLatest` folds two of the three ref-plus-getter triples, since `editorRef` is assigned from the editor's lifecycle rather than read from a render and stays a plain ref; `EditorColorPickerButton.test.tsx` and `EditorTextStyleSelect.test.tsx` now render the shared component with an explicit `variant` because the wrappers they rendered are gone; `Mathematics` stays on its own `.extend()` because `createMathematics` extends it again with `getEditor`; `useLatest` writes its ref in a layout effect and hands out a `useCallback` getter, because ESLint's `react-hooks/refs` forbids ref access during render, and the getters sit in dependency arrays because `exhaustive-deps` cannot see that a custom hook's result is stable.
3. ✅ **Attachments** (`refactor/attachments`) - one `Record<AttachmentKind, …>` descriptor table in `lib/attachments.ts` (MIME prefix, allowed types, size cap, Body tag, extension) replacing the if-chain and the per-kind facts spread over seven files; one insert path keyed by kind replacing the four routes (buttons, slash menu, paste/drop, recorder), which fixes the slash-menu video item losing its poster and size; a shared node-view shell for Image, Video and File (deps, state, delete button, the ready/remote/missing branches), which gives Video and File the loading placeholder only Image has; one Body HTML module (`lib/body.ts`) for the attachment attribute, the checklist markup and the strip/extract helpers.
   The kind id `excalidraw` is persisted data and stays; its human-facing name is the glossary's **Drawing**.
   Harmless changes: image validation ignores a `;parameter` on the MIME like the other kinds; a ready `<video>` has the same corner radius as its thumbnail; `EMPTY_CHECKLIST_BODY` carries TipTap's full item markup, which parses to the same document; `validateAttachmentFile` guards an unknown kind with `Object.hasOwn`, so an inherited name such as `constructor` is rejected too; a failed draft create inside `insertFiles` and a drawing Save that throws now report their code instead of an unhandled rejection or a flat `insert-failed`.
   Deviations: Audio and Excalidraw keep their own node views and buttons (their tests pin an inline delete button and a canvas surface); `flip-rows.ts` stays its own module and imports the task-list selector from `body.ts`; the shared Share page keeps its kind switch (it renders from the server's list, not from the Body); the five `declare module` command augmentations stay in the extension files, since TipTap's typing needs them; the insert error toast reads a kind-neutral `editor.attachment.errors.*` set with the cap interpolated (the planned ticket, done here; Czech strings to proofread); the four per-kind button tests and `Audio/Audio.test.ts` fold into table cases in `createAttachmentNode.test.ts`, so `Image.test.ts`, `Video.test.ts`, `File.test.ts`, `Excalidraw.test.ts` and `Audio.test.ts` are gone; `Image/index.ts` and `File/index.ts` lost their button re-exports; the loading pulse defaults to `h-32 w-64 max-w-full` (an inline-block wrapper gives a percentage width nothing to measure) and File's is `h-12.5 w-full`, the height of the row it stands in for.
4. **UI helpers** (`refactor/ui-helpers`) - `useAsync` for the ten cancel-flag effects, a remote-action helper for the six try/toast blocks and one shared link dialog for the two copies, one `exportBackup(store)` for the three export flows, key-bound `PreferenceSwitch`/`PreferenceSegmented` rows for Settings, the `Intent` type carried as one prop through `NotesView`, `NoteEditorDialog` and `Editor` with the picker-versus-direct branch owned by the picker, locale-aware byte and date formatters (which fixes Settings dates ignoring the app locale), and `src/utils/platform.ts` folded into `src/lib`.
5. **Draft** (`refactor/draft`) - `createNoteDraft(id, deps)` with `id`, `ensureSaved()`, `save(header, body)` and `close(...)`, pure TypeScript tested without React; the dialog keeps its state and timer and hands the Draft to the note bar, labels, share and reminder children, so `NoteTagsBar` stops keeping its own copy of the id; `isDraft` becomes `isNew`.
6. **Tour trim** (`refactor/tour-waits`) - `lib/tour` exports the waits `TourProvider` re-implements, bringing it under 500 lines. No controller extraction.

**After the user test, re-grilled then:** the shared sync algorithms for both Local Stores (read, decide, write; fixes the Revision drift below), seam-level `SignedOut`/`Unreachable` on `Remote` so `sync/loop.ts` stops importing the HTTP error, the sync surface split off `LocalStore`, and folding theme, view mode and sidebar state into `PreferencesProvider` with one provider stack shared with the test renderer.

**Tickets** (found by the surveys, fixed by no slice above):
- Dexie and memory stores drift: a Note added again under a purged, unpushed id pushes without its Revision in Dexie and with it in memory (`DexieLocalStore` add paths skip the Tombstone's `rev`). Not reachable from the UI today.
- "What is owed" has three answers: the engine excludes the Tour's Props, `SignOutButton` and `pending()` do not, so leftover Props may block sign-out (unverified).
- `ThemeModeToggleButton` shows the sun while the theme is `system` over a dark OS.
- `EntityActionButtons` hardcodes English Save, Delete and Edit, and `EditButton` is unused; `ColorPickerPanel`'s "Custom" is untranslated.
- `/labels` create, merge and delete have no error path.
- Backups are named `ruflo-backup-...` while the app calls itself YouNotes.
- Four comments in `src/test/fakeServer.ts` and `fakeSync.ts` cite backend paths that no longer exist; `fakeSync.decide` is a hand copy of the backend's `decide.ts` that `contract:pull` could vendor.
- Docs drift outside any slice's files (root `CLAUDE.md` provider list and the "one hidden input" claim, `src/context/CLAUDE.md` on `useTheme` and `useAccount` readers, the per-area `PLAN.md` items naming deleted code) gets one pass after slice 6.
- A cloned Attachment keeps its source's `thumbnailId`, so two rows name one server blob; this covers the editor's paste clone and the Conflicted Copy, and the impact depends on how the backend sweeps blobs.
- `notes.update` and `tags.update` take a change typed `Partial<T>`, which can return a new `id`; Dexie then writes a second row while memory keeps the old key.
  Type them `Partial<Omit<T, 'id'>>`.
- `AnyButtonView` checks nothing about props; making `AttachmentNodeConfig` generic over its component would let `createAttachmentNode` check `componentProps`.
- `withButton`'s `options: object` does not check upstream option names, so a misspelt `types` in TextAlign compiles; typing it as `Partial` of the upstream's options would close that.
- `toolbar/registry.ts` types every leaf as an `ActionButton` view though twelve yield another component; the only typed read is the optional `isActive`.
- Color, Highlight, FontFamily, FontSize and Mathematics are candidates for `withButton` (an overload for custom components, a factory for Mathematics), and the four near-identical text-style tests for one table.
- `SyncProvider.tsx` keeps three latest-value refs written in effects; candidates for `useLatest` once the effect timing is checked.
- `AudioRecorderHost` snapshots `getDeps()` at its own render; `useLatest(getDeps)` read as `deps()()` would read at use time if the host is ever memoised.
- `AttachmentNotDownloaded` renders a remote video as a plain `<img>` with no marker that it is a video.
- `stripHtml` stops at the first `>` inside an attribute value and decodes only five entities; a DOM `textContent` projection would be exact.
- The toolbar picker's `onFiles` and the editor's paste and drop handlers have no test at any level; one table line calling `onFiles([file])` per picker kind and a Playwright paste or drop spec would pin them.
- A non-media file in a paste or drop is dropped silently (`TRANSFER_KINDS` has no `file`), while the toolbar's file picker takes any type; whether a drop should route non-media to `file` is a product decision.
- `dedupeForeignAttachments` (`attachments/insert.ts`, called `void` from the paste handler) awaits `getNoteId` and `cloneAttachment` with no catch, the same unhandled class `insertFiles` just closed.
- The drawing Save's error-code mapping in editor.tsx has no pinning test; the mocked Excalidraw dialog would need a throwing commit.
- Six ESLint warnings pre-exist in `LinkButton`, `themeProvider`, `useLive` and `use-mobile`; clearing them makes `pnpm lint` a zero-warning gate.
- `pnpm test:e2e` logs `ECONNREFUSED 127.0.0.1:3000` proxy errors from the Vite dev server when no backend runs; quiet the proxy in the Playwright web server or skip server calls when no backend is configured.
- `checklistItemIndexAt` (`lib/body.ts`, the card's tick-by-row helper) has no direct unit test; `e2e/checklist.spec.ts` is its only cover.

## Per-area plans

- [`src/data/PLAN.md`](./src/data/PLAN.md) - the Local Store: schema versioning, attachment storage, sync metadata.
- [`src/hooks/data/PLAN.md`](./src/hooks/data/PLAN.md) — attachment actions, optimistic updates, mutation queue.
- [`src/components/editor/PLAN.md`](./src/components/editor/PLAN.md) — M1 extension work in detail.
- [`src/context/PLAN.md`](./src/context/PLAN.md) — auth context, accessibility themes.
