# M4 Slice 3 - Systematic polish sweep

**Status:** not started.

**Goal:** One disciplined pass over the whole app fixing the accumulated rough edges - hover states, missing colour tokens, loading states, semantics/a11y, keyboard, and the remaining editor nodes - so the surface is consistent before the Slice 4 redesign lands on top of it.

**Depends on:** Slices 1-2 (all views/features exist to polish). Do this **before** Slice 4 so the redesign targets a consistent base.

**Cross-cutting rule:** new strings ship `en` + `cs`. Land with tests where behaviour/a11y is involved (not pixels).

## Context

These are the M4.md polish items with no design forks left - pure execution. Grouped so they're one sweep, not scattered edits. Several build on things already present: `ActionButton` carries a `shortcutKeys` prop; `NoteContent` already has a skeleton for cards.

## Tasks

### Task 1 - Hover states + missing colour tokens + de-purple (items 2, 3, 4)

- [ ] Audit every button/icon for a hover state; add consistent hover treatment (final look reconciled with Slice 4, but no dead/no-feedback controls).
- [ ] Fix components missing theme colour changes: **Dialog close button**, **Select** preview/trigger, and sweep for others (grep for hardcoded colours / missing `text-*`/`bg-*` token usage).
- [ ] **De-purple** the attachment/audio toolbar buttons - remove the purple background so they match the other toolbar options (`src/components/editor/extensions/*` NodeViews / toolbar buttons + `AudioRecordButton`).

### Task 2 - Skeletons & loading states (item 5)

- [ ] Extend the existing `NoteContent` skeleton to **attachments** (image thumbnails, excalidraw previews) so cards don't pop in.
- [ ] Add loading affordances where an operation is non-instant (import/export, tag merge, purge): spinner + text describing what's loading.
- [ ] Empty states + copy for the new views: Archive ("Nothing archived"), Trash ("Trash is empty"), no-tag-match - invitation-to-act tone, not blank.

### Task 3 - Desktop note-bar affordance (item 6)

- [ ] Desktop "Take a note" bar: text cursor on hover; gently rotating placeholder ("Capture a thought…", "Add a to-do…", …) with reduced-motion respected.

### Task 4 - Semantics, tab order, screen readers (item 16)

- [ ] Replace decorative `div`s with semantic elements (`section`/`nav`/`header`/`main`/`ul`/`button`); move styling to parent/child selectors where it removes wrapper divs.
- [ ] Ensure the most important controls come first in DOM/tab order; add a skip-to-content link.
- [ ] Route-change **focus-to-heading** (verify from Slice 1); ARIA labels on icon-only buttons; live-region for save-status/undo toasts.
- [ ] Top-level React **error boundary** so a crash shows a recoverable "something went wrong - reload" screen instead of white-screening the PWA.

### Task 5 - Keyboard shortcuts (item 17)

Decisions: `react-hotkeys-hook`; `mod+K` search only for now; verify editor undo/redo incl. attachments.

- [ ] Add dep `react-hotkeys-hook`.
- [ ] `mod+K` → focus/open search (fires even while typing). Show a platform-aware `⌘K` / `Ctrl K` hint chip in the desktop search input.
- [ ] **Verify + test** editor undo/redo restores a deleted attachment node (already works via `history` + deferred GC; lock it with a test in `AudioNodeView`/`editor` tests style).
- [ ] Surface shortcut hints in `ActionButton` tooltips (`shortcutKeys` exists).
- [ ] (Deferred, infra kept) single-key creators `c`/`l`/`p`/`d`/`r`; `?` cheat-sheet overlay.

### Task 6 - Editor insert nodes & slash menu (item's TipTap asks)

Decisions: Link (+ bubble-menu), HR, inline code, text-align (+dep), **plain** code block, slash menu (blocks + media). Wire latent placeholder/typography/autolink.

- [ ] Add dep `@tiptap/extension-text-align`. Wire already-installed `@tiptap/extension-link`, `-placeholder`, `-bubble-menu`, `-floating-menu`, `-typography`.
- [ ] Pattern A extensions (folder + `index.ts` + icon-registry button + Vitest, per `CLAUDE.md`/ADR 0004): **Link** (toolbar popover to enter/edit URL; edit/unlink via bubble menu; autolink on paste), **horizontal rule**, **inline code**, **text-align** (L/C/R), **plain code block**.
- [ ] **Slash menu**: TipTap `Suggestion` util triggered by `/` at the start of an empty line; filtered floating list of **blocks + media** (heading/lists/checklist/quote/code/HR + image/audio/video/file/drawing) → inserts the node. This is the unified keyboard insertion surface (pairs with the hideable toolbar in Slice 4).
- [ ] **Body placeholder** when empty; **markdown input rules** (`# `→heading, `[] `→task, `- `→list).
- [ ] Register new buttons in the relevant `*Section` (and note them for the Slice 4 data-driven toolbar).
- [ ] Tests: one per extension (Pattern A); slash menu filters + inserts; undo restores.

### Task 7 - PWA install + update UX

Decision (late M4 addition): VitePWA is configured but has no user-facing install/update story. Give it one so the installed app feels real and users don't get stuck on stale cached JS.

- [ ] **"Install app" affordance** (A2HS): capture the `beforeinstallprompt` event and surface an install action (e.g. in Settings or a dismissible hint), calling `prompt()` on click; hide it when already installed (`display-mode: standalone`).
- [ ] **"New version available - reload" prompt**: use VitePWA's `registerSW` `onNeedRefresh` (autoUpdate/prompt) to show a toast/banner that reloads to the new service worker on confirm - otherwise users keep running stale cached assets after a deploy.
- [ ] Respect that both are best-effort/browser-gated (no `beforeinstallprompt` on iOS Safari - degrade gracefully).
- [ ] Tests: update-available handler shows the prompt and reload wiring fires on confirm (mock the SW registration).

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual: tab through the app keyboard-only (order sensible, focus visible, skip link works); `mod+K` focuses search; every button has hover + correct colours in light/dark; skeletons on a throttled load; Link/HR/code/text-align/code-block work; `/` menu inserts blocks and media; trigger the error boundary (throw in a dev build) and recover; install the PWA and confirm the update prompt appears after a rebuild+deploy.
