# M4 Slice 1 - Foundations

**Status:** not started.

**Goal:** Put the four load-bearing pieces in place that every later M4 slice reads from - the note lifecycle data model, the router + nav shell, the preferences store, and the Tags feature - plus the zip backup safety net.

**Depends on:** nothing (first M4 slice). Everything in Slices 2-5 assumes Slice 1 is done.

**Decisions:** [ADR 0008](../../adr/0008-tanstack-router-over-react-router.md) (router), [ADR 0009](../../adr/0009-note-lifecycle-model.md) (lifecycle), `CONTEXT.md` lifecycle/checklist/tag glossary. Full rationale: grilling log in `~/.claude/plans/we-have-most-likely-concurrent-tulip.md`.

**Cross-cutting rule:** every new user-facing string ships with `en` + `cs` in `/public/locales/<lng>/translation.json`. Land each task with tests (pragmatic TDD, ADR 0003).

## Context

Ground truth from code exploration: Tags have a full data layer (`useTags`/`useTagActions`) but **zero UI**; `src/pages/settings.tsx` is **empty** and unrouted (`App.tsx` renders `NotesHome` directly, no router); `Note.checklist: string[]` is **dead** (the real checklist is a TipTap TaskList in the Body); there is no note lifecycle. This phase closes all four gaps.

## Tasks

### Task 1 - Lifecycle data model + Dexie bump

Decisions (ADR 0009): `state` enum + orthogonal `pinnedAt` + `color` token + `trashedAt`; remove dead `checklist`; add `Tag.color`. One version bump, no migration (all optional/defaulted).

- [x] `src/models.ts`: add to `Note` - `state: 'active' | 'archived' | 'trashed'`, `pinnedAt?: string`, `color?: string` (palette token key), `trashedAt?: string`. **Remove** `checklist: string[]`. Add `color?: string` to `Tag`.
- [x] `src/db/db.ts`: bump the Dexie version; index `state`, `pinnedAt`, `trashedAt`. **Correction to the original plan:** an `.upgrade()` *is* needed - `state` is indexed and IndexedDB skips rows whose indexed property is `undefined`, so pre-v3 notes would vanish from `where('state')`. The v3 upgrade stamps `state: 'active'` and deletes `checklist`. ADR 0009 updated to match.
- [x] Grep + remove all `checklist` reads/writes (`useNoteActions.ts`, `NoteCard.tsx`, `NoteEditorDialog.tsx`, tests, seeders). The quick-capture checklist path (`EMPTY_CHECKLIST_BODY`) stays - it's body content, unaffected.
- [x] Seeders (`pnpm seed`): give some notes `state`/`pinnedAt`/`color` so the new UI has data.
- [x] Tests: model defaults, Dexie round-trip of the new fields, checklist removal doesn't break note create/update.

### Task 2 - Lifecycle actions + purge + undo

- [x] `src/hooks/data/useNoteActions.ts`: `pinNote`/`unpinNote`, `archiveNote`, `trashNote`, `purgeNote`. **Naming correction:** the lifecycle state→active action is `restoreToActive`, not `restoreNote` - `restoreNote` already existed as the lossless purge-undo, and it covers un-archive as well as un-trash. `deleteNote` was renamed to `purgeNote` to match CONTEXT.md.
- [x] **Undo toasts** for archive/trash/pin, matching the existing delete-undo pattern (sonner): "Note moved to trash - Undo", etc.
- [x] Purge sweep. **Placement correction:** rather than bolting note-purging onto `collectStartupOrphans` (which is attachment GC), this is a separate `purgeExpiredTrash(graceDays = 30)` in `useNoteActions`, run *before* the orphan sweep at `NotesHome` mount so the orphan pass sees a settled attachments table.
- [x] Manual "Empty trash" action (used by the Trash view in A3).
- [x] Tests: each transition; pin cleared on archive/trash; purge respects the 30-day boundary; undo restores prior state.

### Task 3 - TanStack Router + nav shell

Decisions (ADR 0008): file-based routing; typed search params via Zod `validateSearch`.

- [x] Add deps: `@tanstack/react-router` + its Vite plugin; wire the plugin in `vite.config`, add the generated `routeTree.gen.ts` to gitignore/biome-ignore as appropriate.
- [x] Routes: `/` (feed, active), `/archive`, `/trash`, `/settings`, `/settings/labels`, `/tag/:id`. (`/note/:id` optional - defer unless cheap.)
- [x] Rework `src/App.tsx` into the router root; providers (Theme/ViewMode/Notes/Preferences/Tooltip) wrap the router outlet.
- [x] Nav shell (Keep pattern): persistent left **sidebar** on desktop / slide-in **drawer** (hamburger in `Navbar`) on mobile, hosting All notes / Archive / Trash / Labels / Settings. Keep the existing bottom nav for create actions.
- [x] Feed reads `state` per route. **Implemented as** a new `useNoteFeed(scope, query)` hook that owns scoping + search + ordering; `NotesProvider` is now just the search-text holder and `useSearchNotes` was folded into the new hook and deleted. `/note/:id` deferred as the plan allows.
- [x] A11y: on route change move focus to the view's `<h1>`; each view has a heading.
- [x] Tests: route renders the right note set; sidebar/drawer nav; focus moves on navigation.

### Task 4 - PreferencesProvider

Decisions: Dexie key-value `settings` store, Zod schema + version + defaults, async hydration.

- [x] `src/db/db.ts`: add a `settings` key-value table (or a single-row prefs blob). **Implemented as** the generic key-value table (Dexie v4, `settings: 'key'`, model `Setting<T>`) holding one `preferences` row - the blob versions itself, so future preferences cost no Dexie bump.
- [x] `src/context/PreferencesProvider.tsx`: Zod schema (with `version`, and fields we already know we'll need - `toolbar: string[]`, `noteButtonAlignment`, `quickCaptureButtons`, `colorBlind`, `density`, `reducedMotion`, `onboardingSeenAt`), defaults, graceful fallback on parse failure, `usePreferences()` hook, `setPreference` writer. Render children against defaults until hydrated (loading-tolerant, like the feed).
  - **Decision - `toolbar` defaults to `[]`**, meaning "never customised, render the toolbar's own default set". Slice 4 owns the button registry; hardcoding ids here would only give it something to drift from.
  - **Decision - `reducedMotion` is tri-state** (`system | always | never`) rather than a boolean, because `prefers-reduced-motion` already exists and the pref has to be able to *not* override it.
  - Also exposes `hydrated`, so Slice 5's onboarding tour can avoid firing before we know whether `onboardingSeenAt` is set.
- [x] Mount the provider in `App.tsx`. Leave `ThemeProvider`/`ViewModeProvider` on localStorage (future consolidation, noted in `src/context/CLAUDE.md`).
- [x] Settings page shell (`src/pages/settings.tsx`, routed at `/settings`): section scaffold only here; individual toggles land in their owning phases (toolbar in D, colour-blind/density/reduced-motion in D, language switcher in D). Wire theme switcher + a placeholder here. **Implemented as** `SettingsSection`/`SettingsRow` primitives with two real sections (Appearance → theme segmented control; Labels → link to `/settings/labels`). **No dead "coming soon" placeholder** - an empty section is worse UI than an absent one; Task 6 adds the Backup section.
- [x] Tests: schema round-trip, corrupt blob → defaults, write→read.

### Task 5 - Tags end-to-end

Decisions: label popover + create-on-the-fly; rename/delete(confirm)/merge; optional tag colour from the shared palette; inline `#hashtags` deferred.

- [x] `useTagActions.ts`: add `mergeTags(sourceId, targetId)` (reassign `noteTags` source→target, dedupe, delete source). Tag colour: extend `createTag`/`updateTag` to carry `color?`. **Also**: `updateTag` now takes a `{ name?, color? }` patch (was `(id, newName)`) and stamps `updatedAt`, which it previously didn't; `createTag` is idempotent by name, case-insensitively, so create-on-the-fly can't mint "work" next to "Work". Nothing consumed the old signatures - the tag layer had no UI.
- [x] **"＋ Label" popover** (Radix `Popover`, already a dep) in `NoteEditorDialog`: current tags as removable chips + filter input + existing-tags checkbox list + "Create '<query>'" row (create-on-the-fly = `createTag`→`addTagToNote`). Same popover from the card `⋮` menu (built in Slice 3, but expose the component now).
  - **Deviation:** the removable chips sit *next to* the trigger (in `NoteTagsBar`), not inside the popover - the checkbox list already shows what's assigned, so chips inside it would be the same information twice. `TagPopover` stays presentational, so Slice 3's card menu can mount it against the same handlers.
  - The rows are a real `<input type="checkbox">` inside its `<label>`, not the shared `ui/checkbox`: Radix renders that as a `<button>`, which a `<label>` cannot activate, so the row's text would be dead to clicks.
- [x] `NoteCard.tsx`: render the note's tags as read-only pills (colour from `Tag.color`), using `useTagsForNote`.
- [x] **Manage labels view** at `/settings/labels`: list tags with rename (inline), delete (via shared `ConfirmDeleteButton` - detach warning), merge (pick source+target), colour picker. Also gained a create-label row - a manage view with no way to add a label is a dead end.
  - `ConfirmDeleteButton` was attachment-specific and lived under `editor/extensions/attachments/`. Split: `ui/ConfirmDialog.tsx` (the app's one confirm dialog, controlled - merge needs it without a trigger) → `ui/ConfirmDeleteButton.tsx` (generic) → the attachments file is now a thin binding supplying its own copy, so no NodeView call site changed.
  - Colour uses a new `color-picker/NoteColorPicker.tsx` over the palette *tokens* (not the hex-based `ColorPickerPanel` used for text colour). Slice 4's note-colour picker should reuse it.
- [x] Sidebar "Labels" section lists tags → each links to `/tag/:id`. (Landed in Task 3.)
- [x] Tests: assign/create-on-the-fly, `mergeTags` reassignment+dedupe, delete detaches, pills render.

### Task 6 - Export / import backup

Decisions: `.zip` via `fflate`; replace-all restore with auto-backup-before-import.

- [ ] Add dep `fflate`.
- [ ] Export: build `manifest.json` (notes, tags, noteTags, optional preferences) + `attachments/<id>` blob files → zip → download. Lives in Settings.
- [ ] Import: file picker → unzip → **Zod-validate** manifest → confirm dialog → **auto-export current DB first** → wipe all tables → restore. Surface progress + a clear success/failure toast.
- [ ] Tests: export→import round-trip (notes + a binary attachment) restores byte-identical; invalid manifest is rejected before any wipe.

## Deferred / not here

- `navigator.storage.persist()` → pre-release checklist near M5 (protects real end-user data; not dev-stage).
- Merge-style import (defer; overlaps M5 sync/conflict).
- `/note/:id` deep link (optional; add only if cheap).

## Verification

- `pnpm test` green, `pnpm tsc -b --noEmit`, `pnpm check:ci` after each task.
- Manual: create → pin (floats top) → archive (leaves feed, in Archive + search) → trash (only in Trash) → restore → and a purge check with a back-dated `trashedAt`; tag create/assign/merge/rename/delete; nav between all routes with focus landing on headings; export a DB then replace-all import and confirm it matches.
