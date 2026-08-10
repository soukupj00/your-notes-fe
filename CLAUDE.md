# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Open-source self-hosted PWA note-taking app (Google Keep alternative). Mobile-first React SPA with offline support via IndexedDB. Backend sync server is a separate repository — this repo is frontend-only.

## Documentation map

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary (canonical meaning of Note, Tag, Attachment, Sync, etc.).
- [`PLAN.md`](./PLAN.md) — overall roadmap and milestone order.
- [`PRODUCT.md`](./PRODUCT.md) — who the product is for, its positioning and operating context.
- [`DESIGN.md`](./DESIGN.md) — **the visual contract.** The `nightshift` direction ("Day desk, night shop"), its tokens, and its Named Rules, which are binding for any UI work. Written from measurement, not impression, so it also records six defects that must be fixed rather than ported. `.impeccable/design.json` is its machine-readable sidecar (tonal ramps, shadow/motion tokens, component snippets).
- [`docs/adr/`](./docs/adr/) — architecture decision records.
- Per-area docs (each folder has a `CLAUDE.md` = how it works + `PLAN.md` = what's left):
  [`src/db`](./src/db/CLAUDE.md), [`src/hooks/data`](./src/hooks/data/CLAUDE.md), [`src/components/editor`](./src/components/editor/CLAUDE.md), [`src/context`](./src/context/CLAUDE.md).

## Commands

```bash
pnpm dev          # start Vite dev server
pnpm build        # tsc + vite build
pnpm preview      # preview production build locally
```

Package manager is **pnpm**. Do not use npm or yarn.

```bash
pnpm check        # biome check --write (lint + format + import sort, applies safe fixes)
pnpm check:ci     # biome ci .        (non-mutating gate, used in CI)
pnpm format       # biome format --write
pnpm test         # Vitest run (unit/component/data) — wired up in M1
pnpm test:watch   # Vitest watch mode
pnpm test:e2e     # Playwright, specs in e2e/ (wired up in M4 slice 5)
```

Playwright runs against `pnpm dev` (started for you by `playwright.config.ts`) at two breakpoints, `desktop` and `mobile`.
Vitest includes `src/**` only and Playwright's `testDir` is `e2e/`, so neither runner sees the other's files; `tsconfig.node.json` is what typechecks `e2e/` and the two Vite configs.
First run on a machine needs `pnpm exec playwright install chromium`.

> `pnpm lint` (ESLint) is being **replaced by Biome** — see [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md).

## Architecture

### Data layer (`src/db/`, `src/hooks/data/`, `src/models.ts`)

All persistence is via **Dexie** (IndexedDB wrapper). The schema lives in `src/db/db.ts` as `NotesDB extends Dexie`. Domain models are in `src/models.ts` (`Note`, `Tag`, `NoteTag`, `NoteImage`, `NoteAudio`, `NoteFile`).

Data access uses dedicated hooks in `src/hooks/data/`:

- `useTags` / `useTagsForNote` — live queries via `useLiveQuery` from `dexie-react-hooks`
- `useNoteActions` / `useTagActions` — CRUD mutations (create/update/delete)
- `useNoteFeed` — the one feed query: lifecycle/tag scoping plus fuzzy ranked search (Fuse.js, `src/lib/note-search.ts`)
- `useTagsForNote`, `useNoteAttachments` — relationship queries via the `noteTags` join table and the attachment stores

Search/filter state is **not** in a context - it lives in the URL as typed TanStack search params (`q`, `sort`, `dir`, `tags`), validated by `src/lib/note-search-params.ts` and read through `useNoteSearchState()`.
Which note is **open** lives there too, as `note` ([ADR 0014](./docs/adr/0014-the-open-note-lives-in-the-url.md), read through `useOpenNote()`), so the platform back button closes the editor rather than navigating the feed out from under it - the editor is a full-screen sheet below `sm:`, and the app is `display: standalone`, so an installed user has no browser chrome to correct that with.
A note's id is minted when its editor **opens**, not when it is first saved: that id is the dialog's React key and its load-effect dependency, so a mid-session `?note=new` → `?note=<uuid>` swap would remount the editor under a typing user's cursor.
One-shot open *intents* (start the camera, autoplay the first clip) stay in React state - a reload of a URL must not re-fire them.
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

The shell uses the vendored shadcn `Sidebar` as decided in [ADR 0010](./docs/adr/0010-shadcn-sidebar-as-nav-shell.md).
From `sm:` upward it is a full-height, icon-collapsible sidebar, with `SidebarInset` reserving the sidebar's expanded or collapsed width for both the sticky `Navbar` and page content.
Below `sm:` the same sidebar content renders in a wider left-anchored `Sheet` drawer.
`navItems.ts` is the single source of fixed destinations so the desktop rail and mobile drawer cannot drift.
`SideNav` also lists every tag as a link to `/tag/$id`; tags are hidden in the collapsed desktop rail but remain visible in the mobile drawer.
Desktop collapse state is persisted per device in `localStorage` through `useSidebarOpen`.
Settings is intentionally not a sidebar destination: the topbar gear is the single entry point, and it navigates straight to `/settings` on both platforms.
The mobile quick-settings dialog that used to sit behind it is gone - it held copies of the language and theme controls, and only existed because Settings was a one-way trip before there was a back button.

Quick capture is one list of five starts (`src/components/notes/quickCaptureActions.ts`) rendered two ways so they cannot drift: a `＋` speed-dial FAB on mobile (`QuickCaptureBar`) and inline icons on the desktop "Take a note" bar.
Which order the starts appear in, and which thumb the FAB sits under, are stored preferences edited in `settings/QuickCaptureSection.tsx`; the side mirrors the whole dial, not just the button.
Its distance from the bottom edge is `floatingBottomBar.ts`, shared with a view's own floating action pill (Empty trash) because both land in that corner: 24px above the bottom safe-area inset.
The four insets are named once in `globals.css` as `--safe-top/right/bottom/left` and are always *added to* the design's own spacing, never substituted for it.
They only report real numbers because `index.html` carries `viewport-fit=cover`; without it they resolve to 0 in the installed PWA as much as in a tab, which is why this maths did nothing at all until M4 slice 4 task 7.
A desktop browser reports 0 for all four and no emulator exposes a notch, so overriding those four variables on `:root` is how you see a phone's insets without a phone - and `globals.test.ts` gates the pairing.
Media starts carry a `capture` intent that the editor auto-runs on open.

A11y: every view renders an `<h1 tabIndex={-1}>` and calls `useFocusOnMount` on it, so a navigation moves focus to the destination heading instead of stranding it on the link.
The mobile drawer suppresses Radix's close-focus restoration so navigation focus remains on that destination heading.
In the feed views that heading is `sr-only` - the visible title row was dropped in favour of the search bar's controls, but the focus target and the document outline remain.

### Tags / labels (`src/components/tags/`, `src/pages/labels.tsx`)

`NoteTagsBar` (pills + the "＋ Label" popover) is the one place labels are assigned; it resolves an unsaved draft's id lazily through the editor's `ensureNoteId`, the same queue attachments use. `TagPills` renders a note's labels read-only on `NoteCard`, tinted from the shared Note/Tag palette (`lib/note-colors.ts`) via `NoteColorPicker`. `/settings/labels` (`src/pages/labels.tsx`) is the manage view: create, inline rename, colour, merge-into, delete.

### Backup (`src/lib/backup.ts`, `src/components/settings/`)

The whole database exports to a `.zip`: `manifest.json` (notes, tags, noteTags, attachment metadata, the `settings` table) plus one entry per attachment blob at `attachments/<id>` (and `attachments/<id>.thumb`).
Zipping is `fflate`.
`parseBackupZip` is the only validation gate and never writes - restore is replace-all, so an unreadable archive must be rejected while the user's data is still intact.
`restoreBackup` wipes and rewrites in one Dexie transaction, and the UI (`BackupSection`) offers a checked-by-default "save my current data first" inside the confirm dialog - cancelling or failing that save abandons the import.
Saving always goes through `requestSaveTarget`, which asks for the destination *before* the bytes are built (`showSaveFilePicker` needs the click's user activation) and reports `confirmed: false` on the Firefox/Safari anchor fallback, where we must not claim the file landed.
Manifest rows are validated with `z.looseObject`, so unknown (future) fields survive a round-trip.

### Theming (`src/styles/globals.css`, `src/context/themeProvider.tsx`)

Colors use **OKLCH** custom properties defined in `src/styles/globals.css`; this is the live token source for both light and dark.
`ThemeProvider` (`src/context/themeProvider.tsx`) is a **custom** provider (not `next-themes`, despite that package being installed): it persists the choice to `localStorage` and toggles the `light`/`dark` class on `<html>`, supporting a `system` mode via `prefers-color-scheme`.
Theme switching is done at the provider level - no per-component theme logic.
Preferences that CSS rather than React has to act on are stamped onto `<html>` by `DocumentPreferences` (`src/components/DocumentPreferences.tsx`): the `cvd` colour-blind class, `data-density`, and `data-reduced-motion`.
The test for belonging there is whether the stylesheet needs the value - density re-values the type and rhythm tokens, and reduced motion has to overrule the `prefers-reduced-motion` media query, which JS cannot reach into.
Every other preference is read by the component that spends it.
The 44px Touch Rule has two mechanisms and they are not interchangeable: `.touch-target` grows a control to 44px (right for an icon button), `.touch-reach` gives it a 44px hit box via an invisible centred `::before` and leaves it its own size (right whenever the control's shape is part of what it says, such as a switch).

### The Tour (`src/lib/tour/`, `src/context/TourProvider.tsx`)

The five-step onboarding Tour ([ADR 0015](./docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)).
It **demonstrates**: every step drives the real app, and the user presses Next, Back or Skip and nothing else.

- It acts on **Props** — three Notes it creates at the start and Purges at the end (`CONTEXT.md`), because a fresh install has an empty Feed and nothing to spotlight.
The rules live in `lib/tour/props.ts` and they are the part worth reading before changing anything: a bug there does not land a spotlight badly, it deletes something the user wrote.
A Prop is only purged while its `updatedAt` still matches the baseline the Tour last recorded, so **every act that writes to a Prop rebases it** — the `TourStage` handed to a step only offers the rebasing writers, so a step cannot forget.
The baselines live in the `tourProps` preference rather than React state so a reload mid-Tour leaves something to sweep, and the seed writes notes and baselines in **one transaction** across both stores.
- **Nothing in `src/lib/tour/` imports `driver.js` or React.** That separation is what makes the steps, the targets, the Prop rules and the inert marking testable at all; `TourProvider` is the only place that knows a spotlight library exists.
- **A step is a scene, not a layer.** Moving between steps is `exit` the one being left, then `enter` the one arriving, in both directions — the app's state is not additive (step 2's editor covers the wall step 3 points at). Steps 4 and 5 are Settings looked at twice and say so with `continues`.
- **Everything except the popover is `inert`** for the Tour's lifetime (`lib/tour/inert.ts`), which traps focus, blocks the pointer and stops step 2 raising a phone's keyboard, all with one attribute.
- Targets are resolved by **first match with a non-zero rect** (`lib/tour/targets.ts`), because several of the app's surfaces are mounted twice with CSS hiding one.
- Waiting is always on a **DOM condition, never a timer** (`lib/tour/waitFor.ts`): reduced motion is a hard killswitch, so a fixed wait is wrong in both directions at once.
- `onboardingSeenAt` is stamped when the Tour is **offered**, before a single Prop exists — not on completion, which would re-arm it after every reload.
- The Tour's own behaviour is verified by `e2e/onboarding.spec.ts` at two breakpoints, not by Vitest: jsdom measures every element as 0x0, so a hole cut over nothing is invisible there.

### i18n (`src/i18n.ts`)

Uses **i18next** with browser language detection. Translations are loaded from `/public/locales/<lng>/translation.json`. Fallback language is `en`. The `t()` function is passed into extension button factories for tooltip translations.
`src/i18n.test.ts` gates the bundles against each other: the same base keys in every locale (plural suffixes differ by language, so they are folded), and every key the Tour *composes* at render time resolving in both.

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
