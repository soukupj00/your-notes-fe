# M4 Slice 3 - Systematic polish sweep

**Status:** not started.

**Goal:** One disciplined pass over the whole app fixing the accumulated rough edges - hover states, missing colour tokens, loading states, semantics/a11y, keyboard, and the remaining editor nodes - so the surface is consistent before the Slice 4 redesign lands on top of it.

**Depends on:** Slices 1-2 (all views/features exist to polish). Do this **before** Slice 4 so the redesign targets a consistent base.

**Cross-cutting rule:** new strings ship `en` + `cs`. Land with tests where behaviour/a11y is involved (not pixels).

## Context

These are the M4.md polish items with no design forks left - pure execution. Grouped so they're one sweep, not scattered edits. Several build on things already present: `ActionButton` carries a `shortcutKeys` prop; `NoteContent` already has a skeleton for cards.

## Tasks

### Task 1 - Hover states + missing colour tokens + de-purple (items 2, 3, 4)

- [x] Audit every button/icon for a hover state; add consistent hover treatment (final look reconciled with Slice 4, but no dead/no-feedback controls).
- [x] Fix components missing theme colour changes: **Dialog close button**, **Select** preview/trigger, and sweep for others (grep for hardcoded colours / missing `text-*`/`bg-*` token usage).
- [x] **De-purple** the attachment/audio toolbar buttons - remove the purple background so they match the other toolbar options (`src/components/editor/extensions/*` NodeViews / toolbar buttons + `AudioRecordButton`).

### Task 2 - Skeletons & loading states (item 5)

- [x] Extend the existing `NoteContent` skeleton to **attachments** (image thumbnails, excalidraw previews) so cards don't pop in.
      Note: attachments do not persist intrinsic `width`/`height`, so the reserved box uses a fixed 16/10 guess.
      Populating those (already-declared) `Attachment` fields at create time would make the reservation exact - deferred, flagged as a follow-up.
- [x] Add loading affordances where an operation is non-instant (import/export, tag merge, purge): spinner + text describing what's loading.
- [x] Empty states + copy for the new views: Archive ("Nothing archived"), Trash ("Trash is empty"), no-tag-match - invitation-to-act tone, not blank.

### Task 3 - Desktop note-bar affordance (item 6)

- [x] Desktop "Take a note" bar: text cursor on hover; gently rotating placeholder ("Capture a thought…", "Add a to-do…", …) with reduced-motion respected.
      Extracted to `components/notes/DesktopCaptureBar.tsx`; the new `useReducedMotion()` hook is what finally gives the declared `reducedMotion` preference a consumer.

### Task 4 - Semantics, tab order, screen readers (item 16)

- [x] Replace decorative `div`s with semantic elements (`section`/`nav`/`header`/`main`/`ul`/`button`); move styling to parent/child selectors where it removes wrapper divs.
      The feed is now a `<ul>`/`<li>`; settings/nav/header were already semantic.
- [x] Ensure the most important controls come first in DOM/tab order; add a skip-to-content link.
- [x] Route-change **focus-to-heading** (verified: `useFocusOnMount`, covered in `layout.test.tsx`); ARIA labels on icon-only buttons (the locale button had none); live-region for save-status (it was mounted together with its first message, so it never announced) - undo toasts ride Sonner's own region.
- [x] Top-level React **error boundary** so a crash shows a recoverable "something went wrong - reload" screen instead of white-screening the PWA.

> Found during the sweep: `src/components/ColorPicker.tsx` is dead code (nothing imports it) and carries hardcoded English strings. Left in place - deleting it is a separate call.

### Task 5 - Keyboard shortcuts (item 17)

Decisions: `react-hotkeys-hook`; `mod+K` search only for now; verify editor undo/redo incl. attachments.

- [x] Add dep `react-hotkeys-hook`.
- [x] `mod+K` → focus/open search (fires even while typing). Show a platform-aware `⌘K` / `Ctrl K` hint chip in the desktop search input.
      The Navbar renders two `SearchInput`s (desktop + mobile), so the binding is opt-in via `enableShortcut` - both binding it raced and could focus the hidden one.
- [x] **Verify + test** editor undo/redo restores a deleted attachment node (already works via `history` + deferred GC; lock it with a test in `AudioNodeView`/`editor` tests style).
      `extensions/history/attachment-undo.test.ts`. Note the test must force a history group boundary (`closeHistory`), or the insert and delete collapse into one undo step and the test passes for the wrong reason.
- [x] Surface shortcut hints in `ActionButton` tooltips (`shortcutKeys` exists).
      Already wired; TaskList was the one button missing its hint (upstream `Mod-Shift-9`).
- [ ] (Deferred, infra kept) single-key creators `c`/`l`/`p`/`d`/`r`; `?` cheat-sheet overlay.

### Task 6 - Editor insert nodes & slash menu (item's TipTap asks)

Decisions: Link (+ bubble-menu), HR, inline code, text-align (+dep), **plain** code block, slash menu (blocks + media). Wire latent placeholder/typography/autolink.

- [x] Add dep `@tiptap/extension-text-align`. Wire already-installed `@tiptap/extension-link`, `-placeholder`, `-bubble-menu`, `-typography`.
      Also needed `@tiptap/extension-code`, `-code-block`, `-horizontal-rule` and `@tiptap/suggestion`: StarterKit bundles those but re-exports only `StarterKit`, so importing them without declaring them would be a phantom dependency.
      `-floating-menu` is still unused - the slash menu covers what it would have.
- [x] Pattern A extensions (folder + `index.ts` + icon-registry button + Vitest, per `CLAUDE.md`/ADR 0004): **Link** (toolbar popover to enter/edit URL; edit/unlink via bubble menu; autolink on paste), **horizontal rule**, **inline code**, **text-align** (L/C/R), **plain code block**.
- [x] **Slash menu**: TipTap `Suggestion` util triggered by `/` at the start of an empty line; filtered floating list of **blocks + media** (heading/lists/checklist/quote/code/HR + image/audio/video/file/drawing) → inserts the node. This is the unified keyboard insertion surface (pairs with the hideable toolbar in Slice 4).
      Media items reuse the existing insertion pipeline; image/video/file open a throwaway `<input type=file>` created inside the activation, since a menu row has no element to hang a persistent hidden input on.
- [x] **Body placeholder** when empty; **markdown input rules** (`#` + Space → heading, `[]` + Space → task, `-` + Space → list).
      The rules come from upstream; `markdown-input-rules.test.ts` proves they survive our wrappers (a wrapper missing `...this.parent?.()` drops them silently).
- [x] Register new buttons in the relevant `*Section` (and note them for the Slice 4 data-driven toolbar).
      `code` + `link` in FormatSection; `codeBlock`, `horizontalRule`, `textAlign` in BlocksSection.
- [x] Tests: one per extension (Pattern A); slash menu filters + inserts; undo restores.

> **Trap worth remembering.** `BubbleMenu`'s update effect lists `shouldShow` and `options` in its dependencies and dispatches a transaction when either changes identity.
> The editor runs with `shouldRerenderOnTransaction: true`, so passing inline literals is an infinite render loop: every note click died with "Maximum update depth exceeded".
> Both props are module-level constants in `LinkBubbleMenu.tsx` - do not inline them back.
> This reached the app because every editor suite rendered *without* `editable` and `NoteEditorDialog.test.tsx` mocks the editor out, so nothing ever mounted the toolbar or the plugin views.
> `NoteEditorDialog.realEditor.test.tsx` closes that gap and is verified to fail if the literals come back.

### Task 7 - PWA install + update UX

Decision (late M4 addition): VitePWA is configured but has no user-facing install/update story. Give it one so the installed app feels real and users don't get stuck on stale cached JS.

- [x] **"Install app" affordance** (A2HS): capture the `beforeinstallprompt` event and surface an install action (e.g. in Settings or a dismissible hint), calling `prompt()` on click; hide it when already installed (`display-mode: standalone`).
- [x] **"New version available - reload" prompt**: use VitePWA's `registerSW` `onNeedRefresh` (autoUpdate/prompt) to show a toast/banner that reloads to the new service worker on confirm - otherwise users keep running stale cached assets after a deploy.
- [x] Respect that both are best-effort/browser-gated (no `beforeinstallprompt` on iOS Safari - degrade gracefully).
- [x] Tests: update-available handler shows the prompt and reload wiring fires on confirm (mock the SW registration).

> **Bundle follow-up.** TanStack route splitting, a lazy `NoteEditorDialog`, and a second lazy boundary around `ExcalidrawDialog` reduced the initial application JavaScript from about 2.78 MB to 0.85 MB (887 KB to 270 KB gzip).
> Opening a normal note loads TipTap but not Excalidraw; the drawing engine loads only when a drawing opens.
> Excalidraw's dependency-owned Mermaid and font-subsetting chunks remain large, and Workbox still precaches the full roughly 9.1 MB asset set so those features remain available offline.
> Brave's "Banner not shown" console message is expected because the app suppresses the native install banner with `preventDefault()` and calls the one-shot `prompt()` from Settings instead; cancelling consumes that prompt until the browser offers it again.

## Verification

- `pnpm test`, `pnpm tsc -b --noEmit`, `pnpm check:ci`.
- Manual: tab through the app keyboard-only (order sensible, focus visible, skip link works); `mod+K` focuses search; every button has hover + correct colours in light/dark; skeletons on a throttled load; Link/HR/code/text-align/code-block work; `/` menu inserts blocks and media; trigger the error boundary (throw in a dev build) and recover; install the PWA and confirm the update prompt appears after a rebuild+deploy.
