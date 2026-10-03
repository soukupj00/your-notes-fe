# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Open-source self-hosted PWA note-taking app (Google Keep alternative). Mobile-first React SPA with offline support via IndexedDB. Backend sync server is a separate repository — this repo is frontend-only.

## Hard rules

- Comments are for the human developer reading the code, never for agents.
  Agents get their context from the `.md` files (this file, `CONTEXT.md`, `DESIGN.md`, the ADRs, `docs/`), so a comment never briefs an agent.
- Code explains itself first: clean names and small functions say what the code does.
  A comment adds only what the code cannot say: why, a decision (link the ADR), a trap, or a constraint from outside the code.
- A comment is one to three lines.
  An explanation that needs more belongs in the area's `CLAUDE.md`, `CONTEXT.md` or an ADR, with a one-line pointer in the code.
- Never narrate the next line, never explain styling or layout (Tailwind classes), and write no comment where the code is already clear.

## Documentation map

- [`CONTEXT.md`](./CONTEXT.md) — domain glossary (canonical meaning of Note, Tag, Attachment, Sync, etc.).
- [`PLAN.md`](./PLAN.md) — overall roadmap and milestone order.
- [`PRODUCT.md`](./PRODUCT.md) — who the product is for, its positioning and operating context.
- [`DESIGN.md`](./DESIGN.md) — **the visual contract.** The `nightshift` direction ("Day desk, night shop"), its tokens, and its Named Rules, which are binding for any UI work. Written from measurement, not impression, so it also records six defects that must be fixed rather than ported. `.impeccable/design.json` is its machine-readable sidecar (tonal ramps, shadow/motion tokens, component snippets).
- [`docs/adr/`](./docs/adr/) — architecture decision records.
- Per-area docs (each folder has a `CLAUDE.md` = how it works + `PLAN.md` = what's left):
  [`src/data`](./src/data/CLAUDE.md), [`src/hooks/data`](./src/hooks/data/CLAUDE.md), [`src/components/editor`](./src/components/editor/CLAUDE.md), [`src/context`](./src/context/CLAUDE.md).

## Commands

```bash
pnpm dev          # start Vite dev server
pnpm build        # tsc + vite build
pnpm preview      # preview production build locally
```

For the Account screens (Settings, `/pair`), run the backend's `pnpm dev` in `../ni-dip-be` alongside: Vite proxies `/api` and `/health` to it on port 3000.
The Pairing Link the backend prints points at port 3000, which serves no app in dev, so open its `/pair#<code>` on port 5173 instead.

Package manager is **pnpm**. Do not use npm or yarn.

```bash
pnpm check        # biome check --write (lint + format + import sort, applies safe fixes)
pnpm check:ci     # biome ci .        (non-mutating gate, used in CI)
pnpm format       # biome format --write
pnpm test         # Vitest run (unit/component/data) — wired up in M1
pnpm test:watch   # Vitest watch mode
pnpm test:e2e     # Playwright, specs in e2e/ (wired up in M4 slice 5)
pnpm test:e2e:pwa # Playwright against the production build: service worker and offline
```

Playwright runs against `pnpm dev` (started for you by `playwright.config.ts`) at two breakpoints, `desktop` and `mobile`.
`e2e/pwa/` is the exception: `playwright.config.ts` skips it, and `playwright.pwa.config.ts` runs it against `pnpm build && pnpm preview` at one width, because `pnpm dev` serves no service worker.
Vitest includes `src/**` only and Playwright's `testDir` is `e2e/`, so neither runner sees the other's files; `tsconfig.node.json` is what typechecks `e2e/` and the two Vite configs.
First run on a machine needs `pnpm exec playwright install chromium`.

> `pnpm lint` (ESLint) is being **replaced by Biome** — see [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md).

## Architecture

### Data layer (`src/data/`, `src/hooks/data/`, `src/models.ts`)

All persistence goes through the `LocalStore` interface (`src/data/`, [ADR 0020](./docs/adr/0020-the-local-store-seam.md)); the default implementation is Dexie/IndexedDB, and Dexie is imported nowhere else (Biome enforces it).
Domain models are in `src/models.ts`.

Data access uses dedicated hooks in `src/hooks/data/`:

- `useTags` / `useTagsForNote` - live queries via `useLive`
- `useNoteActions` / `useTagActions` — CRUD mutations (create/update/delete)
- `useNoteFeed` — the one feed query: lifecycle/tag scoping plus fuzzy ranked search (Fuse.js, `src/lib/note-search.ts`)
- `useTagsForNote`, `useNoteAttachments` — relationship queries via the `noteTags` join table and the attachment stores

Search/filter state is **not** in a context - it lives in the URL as typed TanStack search params (`q`, `sort`, `dir`, `tags`), validated by `src/lib/note-search-params.ts` and read through `useNoteSearchState()`.
Which note is **open** lives there too, as `note` ([ADR 0014](./docs/adr/0014-the-open-note-lives-in-the-url.md), read through `useOpenNote()`), so the platform back button closes the editor rather than navigating the feed out from under it - the editor is a full-screen sheet below `sm:`, and the app is `display: standalone`, so an installed user has no browser chrome to correct that with.
A note's id is minted when its editor **opens**, not when it is first saved: that id is the dialog's React key and its load-effect dependency, so a mid-session `?note=new` → `?note=<uuid>` swap would remount the editor under a typing user's cursor.
The one-shot half of an open is an **Intent** (`src/lib/intent.ts`: begin recording, open the Drawing, insert the chosen files, begin as a Checklist, play the first clip), kept in React state by `useOpenNote` and spent when the open ends, so a reload, Back or Forward never repeats it.
The `NotesProvider` that used to hold the query is gone: a searched feed is now shareable, refresh-proof, and steppable with the back button.

### Editor (`src/components/editor/`)

Built on **TipTap v3**. The core `Editor` component (`editor.tsx`) composes extensions and renders `EditorContent`.

Most toolbar extensions are the upstream TipTap extension plus an `ActionButton` `button` option, built by `withButton` (`src/components/editor/extensions/withButton.ts`); a custom component types its option `ButtonView<typeof X>`:

```ts
export const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: { action, isActive, icon: 'Bold', tooltip: t('editor.bold.tooltip'), shortcutKeys: ['Mod', 'B'], toggle: true },
}));
```

The one-button marks and blocks are declarations in `extensions/formatting.ts`; an extension with more than its declaration (a node view, a plugin, a coordinator) has a folder `extensions/<Name>/` with `<Name>.ts` and an `index.ts` re-export.
The `icon` prop is a **string key** resolved via `src/components/icons/icons.ts`, which maps names to Lucide icon components. When adding a new icon for a toolbar button, add it to that registry.

`ActionButton` (`src/components/ui/ActionButton.tsx`) is the shared toolbar button: wraps a Radix Toggle/Button with Tooltip and resolves the icon string from the registry.
Pattern A (extension-owned buttons, [ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md)) is the only pattern; the toolbar itself is the registry in `toolbar/` ([ADR 0011](./docs/adr/0011-toolbar-items-and-families.md)).
See [`src/components/editor/CLAUDE.md`](./src/components/editor/CLAUDE.md).

### Routing (`src/routes/`, `src/routeTree.gen.ts`)

**TanStack Router** with file-based routing ([ADR 0008](./docs/adr/0008-tanstack-router-over-react-router.md)). Route modules live in `src/routes/`; the `@tanstack/router-plugin` Vite plugin (wired in both `vite.config.ts` and `vitest.config.ts`) regenerates `src/routeTree.gen.ts` from them. That file is **generated and committed** — never edit it; it is excluded from Biome and `tsc` reads it directly. Colocated `*.test.tsx` files inside `src/routes/` are excluded from generation via `routeFileIgnorePattern`.

Routes: `/` (active feed), `/archive`, `/trash`, `/labels`, `/tag/$id`, `/settings`, `/pair` (where every Pairing Link lands; the code rides in the fragment), and `/share/$token` (a Share Link's read-only page).
`/share/$token` is opened by strangers, so `__root.tsx` renders it bare (no shell, no Tour, no sync loop, no startup sweeps) and `main.tsx` gives it an in-memory Local Store: it writes nothing to the viewer's IndexedDB.
`main.tsx` also gives it no Account (no `AccountService`, no `Remote`), so it never asks the server for a Session.
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

Quick capture is one list of Starts (`src/components/notes/quickCaptureActions.ts`) rendered two ways so they cannot drift: a `＋` speed-dial FAB on mobile (`QuickCaptureBar`) and inline icons on the desktop "Take a note" bar.
Which order the starts appear in, and which thumb the FAB sits under, are stored preferences edited in `settings/QuickCaptureSection.tsx`; the side mirrors the whole dial, not just the button.
Its distance from the bottom edge is `floatingBottomBar.ts`, shared with a view's own floating action pill (Empty trash) because both land in that corner: 24px above the bottom safe-area inset.
The four insets are named once in `globals.css` as `--safe-top/right/bottom/left` and are always *added to* the design's own spacing, never substituted for it.
They only report real numbers because `index.html` carries `viewport-fit=cover`; without it they resolve to 0 in the installed PWA as much as in a tab, which is why this maths did nothing at all until M4 slice 4 task 7.
A desktop browser reports 0 for all four and no emulator exposes a notch, so overriding those four variables on `:root` is how you see a phone's insets without a phone - and `globals.test.ts` gates the pairing.
The software keyboard gets the same treatment: `useKeyboardInset` publishes how much of the layout viewport it covers as `--keyboard-inset` on `<html>`, which `globals.css` declares as `0px` until the first measurement.
It exists because iOS Safari ignores `interactive-widget=resizes-content` and draws the keyboard over the page, so a bar pinned to the bottom of a full-height sheet sits behind it.
`window.visualViewport` reports the truth on both platforms, so it is one mechanism rather than a platform branch: on Android the layout viewport has already shrunk and the inset comes out near 0.
`offsetTop` is part of the sum because iOS scrolls the page to keep the focused field visible, which moves the visual viewport's origin as well as its height.
It is one CSS variable rather than React state because there is one keyboard and its consumers are CSS lengths, which state could only reach by re-rendering the editor on every frame of the keyboard's slide.
Each Start carries at most one Intent (`quickCaptureActions.ts`).
Image and Camera are picker Starts: `useStartPicker.tsx` opens the OS picker inside the tap itself (each bar renders its own hidden input through the hook), because the tap's user activation does not survive the route change to the editor, and the chosen files become the Intent.
A Checklist on a Card is ticked by tapping its box or its words (`lib/point-over-text.ts` asks the text's own line boxes, since the block spans the row); the empty run after the words is still the card, and press-and-hold on a row opens the Note (`lib/long-press.ts`); in the editor a row is reordered by its grip (`extensions/TaskItem/`), driven by pointer events so a finger can use it.

A11y: every view renders an `<h1 tabIndex={-1}>` and calls `useFocusOnMount` on it, so a navigation moves focus to the destination heading instead of stranding it on the link.
The mobile drawer suppresses Radix's close-focus restoration so navigation focus remains on that destination heading.
In the feed views that heading is `sr-only` - the visible title row was dropped in favour of the search bar's controls, but the focus target and the document outline remain.

### Tags / labels (`src/components/tags/`, `src/pages/labels.tsx`)

`NoteTagsBar` (pills + the "＋ Label" popover) is the one place labels are assigned; it resolves an unsaved draft's id lazily through the editor's `ensureNoteId`, the same queue attachments use. `TagPills` renders a note's labels read-only on `NoteCard`, tinted from the shared Note/Tag palette (`lib/note-colors.ts`) via `NoteColorPicker`. `/labels` (`src/pages/labels.tsx`) is the manage view: create, inline rename, colour, merge-into, delete. It is a Destination beside Archive and Trash rather than a page inside Settings - `navItems.ts` had always listed it there, and Settings no longer carries a section that only links to it.

### Reminders (`src/lib/reminder*.ts`, `src/lib/hand-off.ts`, `src/components/reminders/`)

A Reminder is two unindexed fields on the Note, `remindAt` and `repeat` ([ADR 0021](./docs/adr/0021-reminders-are-handed-off-to-the-calendar.md)).
**The app never notifies** - no Notification permission, no service-worker code, no timers - because a web app without push cannot fire anything while closed; the alarm belongs to the user's calendar.
Setting a Reminder *is* handing it off: `useNoteReminder` (`src/components/notes/useNoteReminder.ts`, beside `NoteEditorDialog` rather than inside it, which is already the app's longest file) persists the draft, builds the `.ics` (`lib/reminder-ics.ts`, hand-written - the plan of 2026-09-20 records why no package), calls `handOff`, and only then writes the fields; a dismissed share sheet writes nothing.
The bell is lit last, after the write rather than before it: colour and pin are optimistic because the tap should answer instantly, but a lit bell over a failed write would promise an alarm that nothing recorded.
`remindAt` is a **local wall-clock string** (`YYYY-MM-DDTHH:mm`), the one deliberate exception to the ISO-timestamp convention, written to the file as a floating time so 09:00 stays 09:00 across a DST change.
`handOff` (share on a coarse pointer that can share files, otherwise download) is the one function whose real behaviour only exists on a device, which is why it is one function.
The `ReminderButton` sits in `NoteEditorBar` because a draft can carry one; the Card's `ReminderChip` is a record, not a control.
A one-shot whose time has gone is **struck through**, not faded: the chip is already at the 11px label floor, and the obvious `opacity-60` measured 2.68:1 light and 3.46:1 dark, under WCAG 1.4.3 in both themes.
The strike is pixels only, so the past state is also in the chip's accessible name (`reminders.chipPast`).
It stays for a day and then lapses: `reminderOf` (`lib/reminder.ts`), the one gate the chip and the bell both read through, stops returning a one-shot more than 24h past - a way of showing the Note, never a write, so nothing bumps `updatedAt` and there is still no timer.
A lapsed one-shot's fields are never cleared, because that write would reorder the feed and sync as an edit; they wait to be overwritten by the next Reminder, and the chip goes on the first render after the 24h mark.
`reminderOf` is also the validation gate for every reader of the fields, the `.ics` included: a backup's `remindAt` is unvalidated because `noteSchema` is loose, and a malformed value would make `Intl.DateTimeFormat` throw.
The popover's two actions are **stacked**, not side by side: together their labels are wider than the popover in Czech, and `e2e/reminder.spec.ts` measures that every button sits inside it.

### Backup (`src/lib/backup.ts`, `src/components/settings/`)

The whole database exports to a `.zip`: `manifest.json` (notes, tags, noteTags, attachment metadata, and an always-empty `settings` array kept for archive compatibility) plus one entry per attachment blob at `attachments/<id>` (and `attachments/<id>.thumb`).
Zipping is `fflate`.
`parseBackupZip` is the only validation gate and never writes - restore is replace-all, so an unreadable archive must be rejected while the user's data is still intact.
`restoreBackup` wipes and rewrites in one Dexie transaction, and the UI (`BackupSection`) offers a checked-by-default "save my current data first" inside the confirm dialog - cancelling or failing that save abandons the import.
Saving always goes through `requestSaveTarget`, which asks for the destination *before* the bytes are built (`showSaveFilePicker` needs the click's user activation) and reports `confirmed: false` on the Firefox/Safari anchor fallback, where we must not claim the file landed.
The three export buttons (Settings, the safety copy before an import, "Save a backup" in the blocked sign-out dialog) share `exportBackup(store, suffix)` in `src/lib/export-backup.ts`, which answers `saved`, `unconfirmed` or `cancelled` and lets each caller choose its words.
Manifest rows are validated with `z.looseObject`, so unknown (future) fields survive a round-trip.

### Theming (`src/styles/globals.css`, `src/context/themeProvider.tsx`)

Colors use **OKLCH** custom properties defined in `src/styles/globals.css`; this is the live token source for both light and dark.
`ThemeProvider` (`src/context/themeProvider.tsx`) is a **custom** provider (not `next-themes`, despite that package being installed): it persists the choice to `localStorage` and toggles the `light`/`dark` class on `<html>`, supporting a `system` mode via `prefers-color-scheme`.
Theme switching is done at the provider level - no per-component theme logic.
`PreferencesProvider` reads `localStorage` synchronously, so the first render already has the user's density and motion choice - no hydration step.
Preferences that CSS rather than React has to act on are stamped onto `<html>` by `DocumentPreferences` (`src/components/DocumentPreferences.tsx`): the `cvd` colour-blind class, `data-density`, `data-reduced-motion` and `data-sink-checked`.
The test for belonging there is whether the stylesheet needs the value - density re-values the type and rhythm tokens, reduced motion has to overrule the `prefers-reduced-motion` media query, which JS cannot reach into, and checklist Sinking is entirely a CSS rule ([ADR 0013](./docs/adr/0013-checklist-sinking-is-presentation-not-storage.md)) that `data-sink-checked` alone switches off.
`DocumentPreferences` is deliberately separate from `ThemeProvider`: the classes and attributes compose in CSS (`.dark.cvd`, `:root[data-density]`), so neither needs to know the other exists, and folding them together would make `ThemeProvider` read Preferences and reorder the providers in `App.tsx`.
Every other preference is read by the component that spends it.
A Settings row that only shows and writes one Preference is a `PreferenceSwitch` or `PreferenceSegmented` bound to its key (`settings/SettingsSection.tsx`); the option lists it offers are the schema's own (`DENSITY_OPTIONS` and friends in `PreferencesProvider.tsx`).
The 44px Touch Rule has two mechanisms and they are not interchangeable: `.touch-target` grows a control to 44px (right for an icon button), `.touch-reach` gives it a 44px hit box via an invisible centred `::before` and leaves it its own size (right whenever the control's shape is part of what it says, such as a switch).

### The Tour (`src/lib/tour/`, `src/context/TourProvider.tsx`)

The six-step onboarding Tour ([ADR 0015](./docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)).
It **demonstrates**: every step drives the real app, and the user presses Next, Back or Skip and nothing else.

- It acts on **Props** — three Notes it creates at the start and Purges at the end (`CONTEXT.md`), because a fresh install has an empty Feed and nothing to spotlight.
The rules live in `lib/tour/props.ts` and they are the part worth reading before changing anything: a bug there does not land a spotlight badly, it deletes something the user wrote.
A Prop is only purged while its `updatedAt` still matches the baseline the Tour last recorded, so **every act that writes to a Prop rebases it** — the `TourStage` handed to a step only offers the rebasing writers, so a step cannot forget.
The baselines live in the Local Store's `meta` under `tourProps` ([ADR 0020](./docs/adr/0020-the-local-store-seam.md)) rather than React state, so a reload mid-Tour leaves something to sweep.
The seed writes the baselines **before** the Prop rows, because the Local Store has no cross-store transaction: a crash in between leaves baselines for Notes that do not exist, which the sweep tolerates, rather than Notes no sweep would ever find.
- **Nothing in `src/lib/tour/` imports `driver.js` or React.** That separation is what makes the steps, the targets, the Prop rules and the inert marking testable at all; `TourProvider` is the only place that knows a spotlight library exists.
- **A step is a scene, not a layer.** Moving between steps is `exit` the one being left, then `enter` the one arriving, in both directions — the app's state is not additive (step 2's editor covers the wall step 3 points at). Steps 4-6 are Settings looked at three times and say so with `continues`; step 4 is where that scene is entered, so `leaveScene` walks the chain back to it.
  `exit` is the strict inverse of `enter`, not a second forward move, so Back is a true inverse; `lib/tour/steps.test.ts` pins that every act has one.
- Step 1 opens the mobile speed dial by clicking the `＋`, because the dial's state lives inside `QuickCaptureBar` with no API to call.
  Whether the dial is open is read from whether its Starts are on screen, never from `aria-expanded`: driver.js stamps `aria-expanded`, `aria-haspopup` and `aria-controls` onto whatever it highlights, so ARIA on a spotlit element belongs to the spotlight.
  Opening is awaited, because driver.js measures the target's rect once and a half-unfolded dial gets half a cutout.
  Closing is not, because step 2's editor covers the screen anyway (on a 4x-throttled phone that wait was 430 ms of the 1363 ms from step 1 to step 2).
  That is safe only because Back from step 2 closes the editor and awaits it; if that stops being true, the symptom is step 1 spotlighting the `＋` instead of the Starts.
- **Everything except the popover is `inert`** for the Tour's lifetime (`lib/tour/inert.ts`), which traps focus, blocks the pointer and stops step 2 raising a phone's keyboard, all with one attribute.
  A `MutationObserver` keeps it a standing rule, because most of what must be marked (the editor dialog, the dial's popover, toasts, driver.js's own overlay) mounts after the Tour starts.
  `inert` blocks hit testing, not dispatch: a programmatic `.click()` inside an inert subtree still runs its React handler, which is how step 1 opens the dial, and Radix's open-focus attempt fails silently rather than looping (both verified in Chromium at both breakpoints).
  An element that was already inert is left alone and never released, so the Tour cannot hand back interactivity the app had taken away.
- The Settings anchors (`data-tour` wrappers) are declared in `src/pages/settings.tsx` rather than inside a section, so no section has to know the Tour exists.
  They wrap rather than mark, because a step points at a block of related rows and a bare `div` changes no layout.
  Editor toolbar and quick capture are two steps, not one block: together they measure 1296px on an 839px phone, and nobody can scroll an `inert` app.
  The toolbar step aims at the preview strip (`settings-toolbar`, marked by `ToolbarPreviewStrip` itself), because `EditorToolbarSection` alone is 880px.
  `HelpSection` sits between the shortcuts and the closing pair, which keeps `PwaInstallSection` and `BackupSection` adjacent for the last step.
- Targets are resolved by **first match with a non-zero rect** (`lib/tour/targets.ts`), because several of the app's surfaces are mounted twice with CSS hiding one.
- Waiting is always on a **DOM condition, never a timer** (`lib/tour/waitFor.ts`): reduced motion is a hard killswitch, so a fixed wait is wrong in both directions at once.
- `onboardingSeenAt` is stamped when the Tour is **offered**, before a single Prop exists — not on completion, which would re-arm it after every reload.
- The Tour's own behaviour is verified by `e2e/onboarding.spec.ts` at two breakpoints, not by Vitest: jsdom measures every element as 0x0, so a hole cut over nothing is invisible there.

### i18n (`src/i18n.ts`)

Uses **i18next** with browser language detection. Translations are loaded from `/public/locales/<lng>/translation.json`. Fallback language is `en`. The `t()` function is passed into extension button factories for tooltip translations.
Numbers and dates are written in the app language through `src/lib/format.ts` (`formatBytes`, `formatDate`), with `useTranslation().i18n.language` passed in at the call; node views get it as `deps.locale`.
`src/i18n.test.ts` gates the bundles against each other: the same base keys in every locale (plural suffixes differ by language, so they are folded), and every key the Tour *composes* at render time resolving in both.
The chosen language is a Preference in the `CONTEXT.md` sense, but not a `PreferencesProvider` field: i18next's language detector owns it and keeps it in `localStorage` itself.
Like every Preference it is a Device fact, so it is not in the backup `.zip` and does not sync.
It was kept out while Preferences lived in Dexie, where it would have flashed English on every cold load; [ADR 0020](./docs/adr/0020-the-local-store-seam.md) moved Preferences to `localStorage`, so that reason no longer holds.
Settings → Language is a Select rather than the segmented control the other settings use, because the list grows with every accepted translation and a segmented control stops working at about four options.

### Path alias

`@/` resolves to `src/`. Use it for all internal imports.

## Tooling & CI/CD

> Target state — being rolled out in [M0](./PLAN.md). Decisions: [ADR 0005](./docs/adr/0005-biome-replaces-eslint-prettier.md) (Biome), [ADR 0006](./docs/adr/0006-ci-cd-and-container-image-distribution.md) (pipeline).

- **Lint + format: Biome** (single tool, config in `biome.json`), replacing ESLint + Prettier. Tailwind class sorting via Biome's nursery `useSortedClasses`. Biome does not format Markdown/YAML.
- **Pre-commit (husky + lint-staged):** runs `biome check --write` on staged files — applies **safe** fixes (format, import sort, safe lint) and re-stages; remaining errors block the commit. Unsafe fixes are never auto-applied.
- **Toolchain pinning:** Node 24 (`.nvmrc`), pnpm via `corepack` pinned by `package.json` `packageManager`. The `Dockerfile` uses `corepack enable` + `pnpm install --frozen-lockfile`.
- **GitLab pipeline** (`.gitlab-ci.yml`): keeps the GitLab SAST + secret-detection templates and adds stages `quality` (`biome ci` + typecheck) → `test` (Vitest + Playwright, as suites land in M1) → `build` (`pnpm build`, `dist/` artifact) → `publish`. On the default branch and tags, `build:image` builds the `Dockerfile` with Kaniko as `$CI_REGISTRY_IMAGE:<short sha>`, `test:smoke` runs it, and crane retags it `latest` (default branch) or `vX.Y.Z` (tag); the backend image builds FROM it.

## Development methodology: pragmatic TDD

Feature work follows **red → green → refactor**, applied pragmatically per layer (see [ADR 0003](./docs/adr/0003-testing-stack-vitest-and-playwright.md)):

- **Test-first (mandatory)** for pure logic/utilities, the Dexie data layer (with `fake-indexeddb`), hooks, and component **behavior** (interactions, contracts like "deleting shows an undo toast"). For a user flow, write the **Playwright acceptance test before** the feature.
- **Build-then-test** for purely visual layout (masonry spacing, shadows, OKLCH rendering); afterward add tests that lock **behavior and accessibility** (roles, labels, keyboard nav) — not pixels.
- **Per unit:** 1) write the failing test against the defined contract/template, 2) implement the minimum to pass, 3) refactor for readability and de-duplication with tests as the safety net.
- Each extension (Pattern A), data hook, and user flow lands **with its tests in the same change**. CI gates on the full suite once M1 wires it up.

## Key conventions

- **Icons**: Always use string keys in `src/components/icons/icons.ts` — never import Lucide icons directly into extension button configs.
- **New TipTap extensions**: `withButton(Upstream, ctx => view)` for an `ActionButton`, a `ButtonView<typeof X>` option for a custom component; a one-button mark or block is a declaration in `extensions/formatting.ts`, anything with more than its declaration gets a folder with `<Name>.ts` + `index.ts`.
- **DB schema changes**: Increment the Dexie version number in `src/data/dexie/db.ts` and add a migration if existing data must be preserved.
- **Dates**: All timestamps stored as ISO strings (`.toISOString()`).
- **IDs and timestamps**: ids are minted only by `mintId` in `src/lib/rows.ts` (`crypto.randomUUID`; a secure context is already a requirement, ADR 0018). Every Note, Tag, NoteTag and Attachment is born through one of its factories, which stamps both timestamps; a later write stamps `updatedAt` itself, as an ISO string.
- **An effect that awaits**: `useAsyncEffect(effect, deps)` (`src/hooks/useAsyncEffect.ts`) owns the cancel flag; the effect gets `alive()` and writes state only while it is true.
  Biome checks its deps array (`biome.json`).
- **A user-started call that toasts its outcome**: `useAction()` (`src/hooks/useAction.ts`) gives `busy` and `run(act, { success, failure })`, which toasts the outcome; `act` answers `false` to back out quietly, and `failure` may pick the key from the error.
- **Tailwind v4** is in use (CSS-based config, not `tailwind.config.js` plugins). `tw-animate-css` provides animation utilities.
- **Lint/format is being migrated to Biome** (one tool for both); see the Tooling & CI/CD section above. Until M0 lands, the repo still has ESLint + Prettier wired into husky/lint-staged.
