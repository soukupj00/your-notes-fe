# Package Audit & UX Direction — Design Spec

**Date:** 2026-06-15  
**Status:** Approved

## Context

After completing M0 (Biome, CI/CD, toolchain pinning), the dependency tree needs a pass before M1 and M3 work begins. Goals: remove dead weight, unblock TS errors, wire in the testing stack, decide which media packages belong in the project, and capture the UX direction that should guide M2/M3/M4 implementation. All choices are shaped by two constraints: **offline-first** (Dexie/IndexedDB is the source of truth) and **mobile-first PWA** (initial bundle size must stay manageable; heavy features lazy-load).

Key insight driving the UX direction: because Dexie is local, **every user action can be instant with no spinners.** Most of the "premium feel" comes from leaning into that fact rather than adding libraries.

---

## Development methodology: pragmatic TDD

All feature work follows a **red → green → refactor** loop (agile/TDD), applied pragmatically per layer. The codebase already has well-defined contracts (the Pattern A extension interface per ADR 0004, the data-hook interfaces in `src/hooks/data/`), which makes test-first tractable. Testing stack and rationale: see [ADR 0003](../../adr/0003-testing-stack-vitest-and-playwright.md).

**Test-first is mandatory for:**

| Layer | Tool | What the failing test asserts first |
|---|---|---|
| Pure logic / utilities | Vitest | input → output of helpers (e.g. `getShortcutKeys`, date/id utils) |
| Data layer | Vitest + `fake-indexeddb` | Dexie CRUD, migrations, soft-delete, search queries behave per contract |
| Hooks | Vitest + Testing Library (`renderHook`) | `useNoteActions`, `useSearchNotes`, media hooks — state transitions & persistence |
| Component **behavior** | Vitest + Testing Library | interactions & contracts: "clicking Bold toggles active", "deleting shows an undo toast", "auto-save fires after debounce" |
| User flows | Playwright | acceptance criteria written **before** the feature: "create → edit → reload → note persists offline" |

**Build-then-test (lock behavior after) for:**

- Purely visual layout — masonry spacing, card shadows, OKLCH color rendering. After building, add tests that lock **behavior and accessibility** (roles, labels, keyboard nav), not pixels.

**The loop per unit of work:**

1. **Red** — write the failing test against the defined contract/template (unit → integration → the e2e acceptance test for the flow).
2. **Green** — implement the minimum to pass.
3. **Refactor** — improve readability, remove duplication, extract shared units — with the tests as the safety net.

**Consequences for the plan:** every milestone's implementation plan is structured as test-first slices, not "build then test." Each extension (Pattern A), each data hook, and each user flow lands with its tests in the same change. CI (`.gitlab-ci.yml`) gates on the full suite once M1 wires it up.

---

## Decisions

### Bundle strategy for heavy features

`@excalidraw/excalidraw` (~1 MB gzipped) and video-related components load via `React.lazy()` + `Suspense`. Vite handles the chunk split automatically on dynamic `import()`. All other media packages weigh < 30 KB each and ship in the main bundle.

### Camera and audio: native APIs, no library

`MediaDevices.getUserMedia()` + `MediaRecorder` are sufficient for camera capture, photo capture, and audio recording. Both return `Blob` objects that write directly to Dexie. Thin custom hooks (`useCameraCapture`, `useAudioRecorder`) in `src/hooks/media/` encapsulate the setup/teardown boilerplate.

### File upload: native input first, `react-dropzone` optional

For a mobile-first app, the smoothest upload path is the **native file input**, which opens the OS camera/gallery instantly with zero JS and zero bundle cost:

```html
<input type="file" accept="image/*" capture="environment">  <!-- rear camera -->
<input type="file" accept="image/*,video/*" multiple>        <!-- gallery picker -->
```

A thin `useFileUpload` hook wraps this. `react-dropzone` is **demoted to optional** — it only adds value on desktop (drag-onto-window, clipboard paste) and is layered in later, not a core dependency.

---

## Changes

### Remove

| Package | Reason |
|---|---|
| `next-themes` | Never imported. Custom `ThemeProvider` in `src/context/themeProvider.tsx` does the job. |

### Add — Phase 0 (now, unblocks TS errors)

```bash
pnpm add @tiptap/extension-link @tiptap/extension-placeholder
```

Both are imported in `src/components/editor/NoteCreateMain.tsx` but never installed. This is the only thing causing the 8 remaining TS errors from `pnpm build`.

### Add — M1 (testing stack, devDeps)

```bash
pnpm add -D vitest @vitest/ui jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @playwright/test
```

- `jsdom` is the Vitest browser environment for component tests.
- `fake-indexeddb` is already present — covers Dexie unit tests.
- `@playwright/test` completes the e2e stack already referenced in `.gitlab-ci.yml`.
- `@vitest/ui` enables `pnpm test --ui` for local test browsing.

### Add — M3 (media attachments, prod)

```bash
pnpm add @excalidraw/excalidraw browser-image-compression
# optional (desktop drag/paste + mobile zoom): pnpm add react-dropzone react-zoom-pan-pinch
```

| Package | Purpose | Integration point |
|---|---|---|
| `@excalidraw/excalidraw` | Drawing tool | TipTap extension wrapping a lazy-loaded `<Excalidraw>` component; scene JSON stored as an `Attachment` in Dexie |
| `browser-image-compression` | Compress photos before IndexedDB write | Called in the attachment write path before persisting the Blob |
| `react-dropzone` *(optional)* | Desktop drag-and-drop + clipboard paste | Layered on top of the native-input `useFileUpload` hook; not core |
| `react-zoom-pan-pinch` *(optional)* | Pinch-to-zoom image viewer | Full-screen image overlay; nice-to-have for mobile UX, not blocking |

---

## UX direction (guides M2/M3/M4)

These are the experience decisions to build toward. They are captured here so the CRUD/media work implements them from the start rather than retrofitting.

### Core feel (M2)

| Decision | Why / how |
|---|---|
| **Optimistic, spinner-free UI** | Local-first means writes are effectively instant. Update React state immediately, persist to Dexie in the background; never block the UI on a write. The single biggest "premium" win, nearly free given the architecture. |
| **Debounced auto-save (no Save button)** | Editing saves automatically (~500ms debounce) as the user types. `lodash.debounce` is already installed. Removes the concept of "saving" entirely. |
| **Quick-capture FAB** | A floating "+" opens a minimal capture sheet from anywhere — the fastest path from intent to a saved note. The core loop of the app. |
| **Masonry note grid** | Keep-style variable-height card grid. CSS columns first; reach for a masonry lib only if ordering needs it. |

### Confidence & safety (M2)

| Decision | Why / how |
|---|---|
| **Undo toasts via `sonner`** | Already installed. Destructive actions show "Note deleted — Undo" for ~5s before committing. Lets users act fearlessly. |
| **Soft-delete (Trash)** | Add `deletedAt` to `Note` (Dexie version bump + migration). Trash view + auto-purge after 30 days. Enables the undo toast and matches the Keep model. |
| **Note colors + pin + archive** | Defining Keep features, all pure local state. Pinned notes float to the top of the grid; per-note color as an OKLCH token tied into the existing theme system. |

### Next level (M3/M4)

| Decision | Why / how |
|---|---|
| **PWA Share Target** | Register the app as an OS share target (manifest + handler route) so users can share text/images from any app into a new note. |
| **View Transitions API** | Native browser API (no library). Card "expands" into the editor on open. Big perceived-quality boost. |
| **Swipe gestures + drag reorder** | Swipe a card to archive/delete on mobile; drag to reorder/pin. Adds `dnd-kit`. High polish, moderate effort. |
| **Custom install prompt (A2HS)** | Capture `beforeinstallprompt`, show a tasteful "Install app" affordance instead of the browser default. |
| **`prefers-reduced-motion`** | Gate View Transitions + swipe animations behind it. Feeds the M4 accessibility goals. |

### Self-hosted / offline-first identity (high value)

These serve the app's defining positioning — self-hosted, open-source, offline-first. They are the reasons someone picks this over Keep.

| Decision | Why / how |
|---|---|
| **Data export/import (Markdown + JSON)** | Data ownership is *the* selling point of self-hosting. Export all notes to a `.zip` of Markdown (attachments inline/linked) + a JSON full-fidelity backup; import to restore. Pure local, no backend. The single most differentiating feature. (M2/M4) |
| **Persistent storage + quota awareness** | Browsers can *evict* IndexedDB under storage pressure — risking data loss. Call `navigator.storage.persist()` and surface usage via `navigator.storage.estimate()`. Critical trust/correctness infra; tiny effort. (M2) |
| **Voice-to-text capture (Web Speech API)** | Hands-free dictation into a note. Native API, no library; pairs with the quick-capture FAB. (M3) |

### Keep-parity & scale

| Decision | Why / how |
|---|---|
| **Reminders (Notifications API)** | Time/date reminder per note → local notification. Classic Keep feature. (M4) |
| **First-class checklists** | Confirm Checklist (per `CONTEXT.md`) is a primary capture mode, with "completed items sink/hide" behavior — not just a raw TipTap task list. (M2/M3) |
| **Image thumbnails** | Store a small compressed thumbnail Blob alongside each full image so the masonry grid loads instantly; full-res loads only on open. Pairs with `browser-image-compression`. (M3) |
| **List virtualization (`@tanstack/virtual`)** | Render only visible cards once note counts grow. Build the grid to accept it; adopt when lag appears. (M4, deferred until needed) |
| **Service-worker update toast** | When `vite-plugin-pwa` detects a new build, show "New version available — Reload" via `sonner`. Prevents users getting stuck on stale cached builds. (M2) |

### Deferred

| Item | Reason |
|---|---|
| **Command palette (`cmdk`)** | Delightful but desktop-leaning. M4 polish, not core for a mobile-first app. |
| **List virtualization** | Only worth adding when a user's note count actually causes lag. Noted above so the grid is built to accept it. |

---

## What stays as-is

| Package | Note |
|---|---|
| `@tiptap/starter-kit` + individual extension packages | Both present and harmless. No action needed. |
| `zod` | Not yet used. Keep — will validate sync API responses in M5. |
| `indexeddbshim` | Used by the `seed` script (Node.js needs a shim to run IndexedDB). Keep in devDeps. |
| `react-colorful` | Active — powers `TextColorPickerButton`. Keep. |
| `@floating-ui/dom` | Used by TipTap's floating/bubble menus. Keep. |

---

## Implementation order

1. **Now:** `pnpm remove next-themes` + `pnpm add @tiptap/extension-link @tiptap/extension-placeholder` → fixes 8 TS errors, cleans up dead dep.
2. **M1:** Add the testing devDeps, wire `vitest.config.ts`, add `pnpm test` script.
3. **M2:** CRUD UI with optimistic writes, auto-save, FAB, masonry grid, undo toasts, soft-delete. Wire `navigator.storage.persist()` on first load + SW update toast (no new packages — native APIs + existing `sonner`).
4. **M3:** Add media packages; implement `useCameraCapture` + `useAudioRecorder` + `useFileUpload` hooks; voice capture via Web Speech API (native); Excalidraw TipTap extension with lazy loading; image thumbnails.
5. **M4:** Reminders, View Transitions, swipe/drag (`dnd-kit`), install prompt, virtualization (`@tanstack/virtual`) if needed.

### Packages implied by the UX features (added at their milestone)

| Package | Feature | Milestone | Notes |
|---|---|---|---|
| `jszip` | Export to a `.zip` of Markdown | M2/M4 | ~100 KB. Alternative: native `CompressionStream`, but `jszip` is far simpler for multi-file archives. |
| `dnd-kit` | Swipe gestures + drag reorder | M4 | Only if drag reorder is built. |
| `@tanstack/virtual` | List virtualization | M4 | Deferred until note count causes lag. |

Native APIs (no package): `navigator.storage.persist/estimate`, Web Speech API (voice), Notifications API (reminders), View Transitions API, `beforeinstallprompt` (install), `MediaDevices`/`MediaRecorder` (camera/audio).

---

## Verification

- After Phase 0: `pnpm build` exits 0 with no TS errors.
- After M1 packages: `pnpm test` runs (even with 0 tests initially).
- After M3 packages: `pnpm build` bundle analysis (via `vite-plugin-visualizer` or `rollup-plugin-visualizer`) shows Excalidraw in a separate chunk, not in the main bundle.
