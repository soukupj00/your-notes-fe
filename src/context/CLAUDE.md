# CLAUDE.md — `src/context` (React providers)

App-wide React context providers. See [`PLAN.md`](./PLAN.md) for upcoming work.

> **`NotesProvider` is gone** (M4 Slice 2). The app-wide search text it held now lives in the URL as typed TanStack search params, read and written through `useNoteSearchState()` (`src/hooks/useNoteSearchState.ts`); the feed itself is `useNoteFeed(scope, search)` per route.
> A context would have made the same state unshareable and invisible to the back button.

## `PreferencesProvider.tsx`

User preferences, persisted as one Zod-validated blob in the Dexie `settings` store under the key `preferences`.

- Dexie rather than `localStorage` on purpose: it is the store M5 will sync, and it rides along in the same export/import backup as the notes.
- `preferencesSchema` owns the shape and every default; `PREFERENCES_VERSION` versions the blob independently of the Dexie schema, so a new preference is a code-only change.
- **Anything unreadable yields defaults** — corrupt value, invalid field, or an unknown `version`. A failed read deliberately leaves the bad blob on disk (the next write replaces it) so a read can never destroy data.
- Hydration is async: `useLiveQuery` returns nothing on the first render, so children see `DEFAULT_PREFERENCES` and re-render when the blob lands. `hydrated` is exposed for the consumers that must not act before then (the onboarding tour).
- `setPreference(key, value)` does a read-modify-write inside a `rw` transaction, so two writes to different keys can't clobber each other, and re-stamps the current `version`.
- **`tourProps` is the one field that is not a user setting.** It is the Tour's live list of Props (`{ id, updatedAt }` apiece, [ADR 0015](../../docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)), stored here rather than in React state precisely because a reload or a closed tab mid-Tour has to leave something for the next start to sweep. It holds `updatedAt` and not bare ids because the Tour's own acts write to Props; the rules live in `src/lib/tour/props.ts`.
- `usePreferences()` throws outside the provider.

> `ThemeProvider` and `ViewModeProvider` still use `localStorage`. Folding them into this store is a deliberate later consolidation (both are read synchronously on first paint, which this async store can't do without a flash).

## `TourProvider.tsx`

The onboarding Tour's lifecycle ([ADR 0015](../../docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)); everything it *decides* is in [`src/lib/tour/`](../lib/tour/) and tested there.

- **It is mounted in `routes/__root.tsx`, not `App.tsx`** — unlike every other provider. The Tour navigates, so it has to be inside `RouterProvider`; and it marks the whole body inert and portals past the app, so it belongs above `Layout` rather than in it.
- **It owns the startup sweep too**, not `__root.tsx`. The sweep and the seed are the same `tourProps` list, and running them from two components races a fresh seed against the old list's purge.
- Auto-start is `hydrated && !onboardingSeenAt && on the Feed`, and then only once the Feed has actually painted (a `waitFor` on the `capture` target). That last gate is also what keeps the Tour out of every jsdom test that renders a route.
- It **marks its own navigations**; any it did not ask for destroys the Tour and takes the Props with it. Several acts *are* navigations (opening a note is a `?note=` search param since ADR 0014), so without the marking the Tour would destroy itself on its own second step.
- Two hooks, and the difference is deliberate: `useTour()` throws outside the provider (its caller is the Replay row, which must not silently do nothing), `useTourActive()` returns `false` (its callers are ordinary components mounted alone in tests, to which "no provider" and "no Tour" mean the same thing).
- `driver.js` is the spotlight, and it is held at arm's length: it measures a rect, cuts a hole and places a box, and everything read or pressed is `components/tour/TourPopover.tsx` portalled into its element. Driver **measures that box exactly once**, so the provider waits for `data-tour-step` to match and for `document.fonts.ready` before handing it over.
- Two workarounds live here and both have a comment saying why: the popover host carries `aria-live="off"` (a modal Radix dialog would otherwise `aria-hidden` it), and it swallows `pointerdown`/`focusin` (Radix's dismissable layers would otherwise read a press on Next as a click outside the note, and close it).

## `themeProvider.tsx`

Custom theme provider (**not** `next-themes`, even though that package is installed).

- Theme type: `'dark' | 'light' | 'system'`.
- Persists the choice to `localStorage` under `storageKey` (default `vite-ui-theme`); `App.tsx` uses `defaultTheme="dark"`.
- On change, toggles the `light`/`dark` class on `document.documentElement`; `system` resolves via `window.matchMedia('(prefers-color-scheme: dark)')`.
- Exposes `{ theme, setTheme }` via the `useTheme()` hook (throws outside the provider).
- The actual color values are the OKLCH custom properties in `src/styles/globals.css`, which is the single live token source for both themes (the old `src/themes.ts` duplicate was deleted in M4 Slice 4).
