# 0010 — shadcn `Sidebar` as the nav shell

- Status: Accepted
- Date: 2026-07-29

## Context

Through M4 Slice 2 the nav shell was hand-rolled (`src/components/layout.tsx`): a persistent `<aside className="hidden w-64 ... sm:block">` on desktop, and the same `SideNav` inside a `Dialog` restyled into a left-anchored drawer on mobile.
`navItems.ts` kept the two in sync.
It worked, but the desktop sidebar could not be collapsed, and a `Dialog` is the wrong primitive for a drawer.

`pnpm dlx shadcn@latest add sidebar` was run, vendoring `src/components/ui/sidebar.tsx`, `src/components/ui/sheet.tsx`, and `src/hooks/use-mobile.tsx`.
That component provides icon-collapse, a mobile `Sheet`, a rail, and tooltips-when-collapsed as a matched set.
It also arrives with several assumptions from its origin (a Next.js app with SSR) that are wrong for this codebase, and adopting it silently would import them.

## Decision

Adopt the vendored `Sidebar` as the nav shell, in full rather than cherry-picked, and restructure the shell around it.

**Shell shape.** `SidebarProvider` wraps `<Sidebar collapsible="icon">` and `<SidebarInset>` as siblings.
The sidebar is full height and owns the top-left corner; `Navbar` moves *inside* `SidebarInset` as its header row, losing the logo (which moves to `SidebarHeader`) and the `leading` hamburger slot (replaced by `SidebarTrigger`).
Our `<main>` is dropped because `SidebarInset` already renders one, and two `main` landmarks is an accessibility violation.

**Collapsed rail shows destinations only.** The four `NAV_ITEMS` collapse to a `4rem` rail with tooltips; the label list is hidden when collapsed.
The rail remains wide enough for symmetric `px-4` item gutters and keeps the wordmark visible until it is replaced by the planned logo mark.
Collapse is a "give me my screen back" gesture, not a lossless compaction.
Settings is intentionally absent from the sidebar because the topbar gear is its single entry point.
On mobile that gear opens quick settings with an "All settings" link to the full settings page.

**Open state lives in `localStorage`**, read synchronously in a `useState` initialiser (the `ViewModeProvider` pattern) and fed to `SidebarProvider` through its `open`/`onOpenChange` props.

**One nav breakpoint: 640px.**
`use-mobile.tsx`'s `MOBILE_BREAKPOINT` is changed from 768 to 640, and `Sidebar`'s own hardcoded `md:` breakpoints are changed to `sm:`.

**Sidebar colour tokens alias the existing semantic tokens** rather than introducing a second palette.

**Seven deliberate edits to the vendored `src/components/ui/sidebar.tsx`**, each carrying a one-line comment in situ:

1. The `document.cookie` write in `setOpen` is deleted.
2. The `Cmd/Ctrl+B` window keydown listener is deleted.
3. `md:` becomes `sm:` (the desktop-branch visibility classes and the touch-target helpers).
4. `onCloseAutoFocus` is prevented on the mobile `SheetContent`.
5. The hardcoded English `SheetTitle` / `SheetDescription` go through `t()`.
6. (In `use-mobile.tsx`, not `sidebar.tsx`) `MOBILE_BREAKPOINT` 768 → 640.
7. The mobile drawer uses 70% of the viewport width and removes the inherited right border and focus outline.

Recording these is the main reason this ADR exists.
A future reader finds a vendored file with deletions in it and will reasonably assume they were accidents, or "fix" them by re-running `shadcn add --overwrite`.
shadcn is a scaffold generator, not a dependency: these files are ours, and there is no upstream to drift from.

## Why each vendored edit

**The cookie was write-only.**
`SidebarProvider` writes `sidebar_state` on every toggle, but nothing in this app reads it.
The cookie exists because shadcn targets Next.js, where a server component reads it and passes it down as `defaultOpen` so the correct width is in the first HTML byte.
This is a Vite SPA with no server render, so `defaultOpen` always won and the sidebar forgot the user's choice on every reload.
The state was therefore not "persistence to relocate" but persistence that was never happening, plus a cookie in an offline-first self-hosted PWA that would raise questions in a later security review.

**`Cmd/Ctrl+B` collided with bold.**
The shortcut was registered on `window` with `preventDefault()`, so it ran ahead of the editor.
In a note-taking app built on TipTap, where `Bold` is a canonical Pattern A extension ([ADR 0004](./0004-canonical-editor-toolbar-pattern.md)), that breaks bold application-wide.
The shortcut was deleted rather than rebound: nobody asked for it, and `SidebarTrigger` is a real `<button>` in the tab order, so keyboard users lose nothing.
If a toggle chord is wanted later it should be added deliberately through `react-hotkeys-hook`, alongside the `mod+K` search shortcut planned in M4 Slice 3 Task 5.

**The two breakpoints created a dead band.**
`use-mobile.tsx` hardcoded 768 while the app switches at Tailwind's `sm:` (640) in 63 places, including the hamburger, both `Navbar` rows, `QuickCaptureBar`, and `NotesView`.
Between 640px and 767px `useIsMobile()` returned `true`, so the sidebar rendered as an off-canvas `Sheet`, while `sm:` had already applied, so the hamburger was hidden: **no navigation at all, and nothing to open it with.**
That band covers common tablet portrait widths.
Aligning the constant alone was insufficient, because `Sidebar`'s desktop branch carries its own `md:block` / `md:flex`, which would have moved the dead band rather than closing it.

**Focus restoration defeated `useFocusOnMount`.**
Radix restores focus to the trigger when a `Sheet` closes.
Tapping a nav link both navigates (mounting a view that focuses its `<h1>`) and closes the drawer, so focus was pulled back to the hamburger immediately after landing.
That contradicts the contract `useFocusOnMount` exists to enforce across `NotesView`, `labels`, and `settings`.
Preventing restoration lets the destination heading win.
The trade-off is that dismissing without navigating (Esc, backdrop) now leaves focus on `<body>` rather than the trigger; closing-by-navigation is the dominant path for a nav menu, and a conditional implementation was judged not worth its state-threading until there is evidence the Esc path matters.

**The drawer's accessible name was untranslated.**
`SheetTitle` was the hardcoded English string "Sidebar" - the accessible name of the entire nav drawer, in an app that ships `en` and `cs`.

**The mobile drawer needs one visual boundary, not three.**
The overlay already separates navigation from content, so the inherited right border and browser focus outline looked like a bright white seam in the dark theme.
The drawer now takes 70% of the viewport width and relies on the blurred overlay plus shadow for its boundary.

## Considered options

- **Cherry-pick only `Sheet` for mobile and hand-roll the desktop icon collapse** — rejected: a usable icon rail needs tooltips that render only when collapsed, which `SidebarMenuButton` already implements correctly. We would have reimplemented it worse.
- **Keep the full-width header with the sidebar below it** (the current, Keep-like arrangement) — rejected: `Sidebar`'s desktop branch is `fixed inset-y-0 h-svh`, so this means overriding its core positioning on day one and maintaining a header-height magic number that two files must agree on. Every future change to the header (a banner, an offline indicator) reopens that arithmetic. It also leaves a hamburger and a logo stacked above the collapsed rail, giving two nav affordances in one corner.
- **Persist open state in the Dexie `settings` blob via `PreferencesProvider`** — rejected on two grounds. Hydration is async, so the sidebar would paint at `16rem` and snap to `4rem` a frame later, shoving the feed sideways; this is the same reasoning already recorded for `ThemeProvider` and `ViewModeProvider` in `src/context/CLAUDE.md`. More fundamentally, sidebar collapse is a per-device form-factor choice (collapsed on a laptop, expanded on a large monitor), so having M5 sync it across devices would be actively wrong.
- **Showing tag colour dots in the collapsed rail** — rejected: `Tag.color` is optional, so an uncoloured tag renders as a blank grey ring, and two tags sharing a palette entry are pixel-identical. A stack of twenty such dots, with names only in tooltips, is decoration that looks like navigation. It also makes the rail scroll, defeating the collapse.
- **A flyout submenu for labels when collapsed** — rejected as complexity not yet needed: hover, touch, and keyboard behaviour to get right for a list that is one click away in the expanded state.
- **Converting shadcn's HSL sidebar tokens to OKLCH, or hand-designing new ones** — rejected for now: the current `<aside>` is plain `background` + `border-r`, so aliasing reproduces today's appearance exactly and keeps this change a layout change rather than a smuggled recolour. One palette also means the colour-blind variants (`PreferencesProvider.colorBlind`, declared but unimplemented) will propagate to the sidebar for free instead of needing a parallel override set. Tinting is deferred to the Slice 3 colour-token pass and remains a one-line change per alias.

## Consequences

- The 640–767px navigation dead band is closed; one breakpoint governs the whole shell.
- Sidebar collapse state now actually persists, which it did not before.
- The header becomes `sticky top-0`, so the search box, sort menu, and label filters stay reachable in a long feed. This matters because the feed's visible title row was already dropped in favour of the search bar's controls.
- The scrolled-state shadow uses a CSS scroll-driven animation (`animation-timeline: scroll()`) inside `@supports`, so it costs no JavaScript, no scroll handler, and no `IntersectionObserver` stub in the test setup. Per MDN browser-compat-data this ships in Chrome/Edge/Samsung 115+ and Safari 26+ (desktop and iOS); Firefox has it in preview only. Firefox users get the sticky header and its `border-b` without the shadow, which is an acceptable loss of a decorative depth cue and needs no code change when Firefox ships.
- `Navbar` no longer contains the brand, and the mobile row deliberately omits it to reduce clutter. `SidebarHeader` is the logo's home.
The wordmark remains visible in both states until the planned logo mark is available, preserving the header's height and the app's identity when collapsed.
- Three dead hooks are removed alongside (`use-window-size`, `use-isomorphic-layout-effect`, `use-unmount`); `use-debounce-callback` and its test are kept, being plausibly wanted and independently tested.
- M4 Slice 3 Task 4 (semantics, tab order, skip-to-content link) now lands on a shell with a single `<main>` and real `nav`/`header` elements. The skip link introduced there should target `SidebarInset`.
