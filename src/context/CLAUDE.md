# CLAUDE.md — `src/context` (React providers)

App-wide React context providers. See [`PLAN.md`](./PLAN.md) for upcoming work.

> **`NotesProvider` is gone** (M4 Slice 2). The app-wide search text it held now lives in the URL as typed TanStack search params, read and written through `useNoteSearchState()` (`src/hooks/useNoteSearchState.ts`); the feed itself is `useNoteFeed(scope, search)` per route.
> A context would have made the same state unshareable and invisible to the back button.

## `AccountProvider.tsx`

Whether this Device is signed in to a Self-hosted Server (ADR 0018; M5 slice 3).

- It asks `AccountService.session()` **once at startup**. The session is an `HttpOnly` cookie, so there is nothing to read locally, and the server that served the app is the server, so there is no URL to configure.
- `status` is `checking`, `unavailable` (nothing answered: a static host, offline, or no service), `signed-out` or `signed-in`. **Nothing in the app waits on it**: sync is opt-in, so every screen renders the same whatever it hears. Only the Account, Devices and Members sections of Settings and `/pair` read it.
- `setSession` takes what a sign-in, pairing or sign-out just answered, so no second request is needed.
- `useAccount()` answers "no server" outside a provider instead of throwing, like `useTourActive()`: its callers are Settings sections that tests mount alone.
- Nothing answered (opened offline, or before the server was up): it asks again on `online` and when the page becomes visible, so the app starts syncing without a restart. A signed-in Device is not re-asked.
- Composed in `App.tsx` around the router; `main.tsx` builds one HAL client and hands it in as both `service` and `remote` (the latter for `SyncProvider`).

## `SyncProvider.tsx`

Runs Sync while this Device is signed in (M5 slice 4, [04-sync.md](../../docs/architecture/04-sync.md)).
What happens in a run is `src/sync/engine.ts`; when a run happens is `src/sync/loop.ts`; both are plain TypeScript and tested against `src/test/fakeServer.ts`, which carries the backend's sync rules.

- **Mounted in `routes/__root.tsx`, inside `TourProvider`**, not in `App.tsx`: its one toast ("N conflicts kept as copies") links to the Conflicts Tag, so it needs the router. The `Remote` reaches it through `AccountProvider`, which `main.tsx` hands both halves of the one HAL client.
- **It stands still while the Tour runs** (`useTourActive()`), and the engine leaves the Tour's Props out of every push, so a Prop never reaches the server even after a reload mid-Tour.
- On a session it first **adopts** (a new Account owes the whole library), then starts the loop; on sign-out or a change of Account it stops it.
- **Attachment bytes** (M5 slice 5) move at the end of each run (`src/sync/attachments.ts`): thumbnails up first, then blobs, every missing thumbnail down.
  Full bytes come down on a tap through `download(id)`, or after every run while the `keepEverything` Preference is on (turning it on starts a run).
  A blob the server refuses for its size is one toast, "<name> is too large to sync", and is never retried.
- Exposes `{ active, status, lastSyncedAt, pending, syncNow, stop, download }`. `pending` is the store's live count of what the server is owed, so it is right signed out too; `stop()` waits for a run in flight, which is what makes erasing safe.
- `useSync()` answers "not syncing" outside a provider, like `useAccount()`.
- Sign-out lives in `components/account/SignOutButton.tsx`: refused while `pending > 0` (offering Sync now and a Backup), otherwise `DELETE /api/session`, `stop()`, then `store.clear()`.

## `PreferencesProvider.tsx`

User Preferences, persisted as one Zod-validated blob in `localStorage` under `PREFERENCES_STORAGE_KEY` ([ADR 0020](../../docs/adr/0020-the-local-store-seam.md); `src/data/dexie/legacyPreferences.ts`, which owns the one-shot migration off the old Dexie row, imports the key from here rather than the other way round - nothing outside `src/data` may import from `src/data/dexie/`).

- `localStorage`, not the Local Store: Preferences are a Device fact (CONTEXT.md), not something M5 syncs, and it is read synchronously so the first render already has the user's density and motion choice - no hydration step, no flash of defaults.
- `preferencesSchema` owns the shape and every default; `PREFERENCES_VERSION` versions the blob independently, so a new preference is a code-only change.
- **Anything unreadable yields defaults** — corrupt value, invalid field, or an unknown `version`. A failed read deliberately leaves the bad blob on disk (the next write replaces it) so a read can never destroy data.
- `setPreference(key, value)` does a read-modify-write against `localStorage` itself (not React state), re-stamps the current `version`, then updates state. Still `async` so no caller had to change when it stopped being a Dexie transaction.
- A `storage` event (another tab writing the same key) is the only other way `preferences` changes; the provider listens for it and re-reads.
- **`tourProps` used to live here and does not any more.** The Tour's Prop baselines are store bookkeeping, not a Preference, and now live in the Local Store's `meta` under `TOUR_PROPS_META_KEY` - see `src/lib/tour/props.ts` (`readProps`/`writeProps`).
- `usePreferences()` returns `{ preferences, setPreference }` and throws outside the provider.

## `TourProvider.tsx`

The onboarding Tour's lifecycle ([ADR 0015](../../docs/adr/0015-the-tour-drives-the-app-on-disposable-props.md)); everything it *decides* is in [`src/lib/tour/`](../lib/tour/) and tested there.

- **It is mounted in `routes/__root.tsx`, not `App.tsx`** — unlike every other provider. The Tour navigates, so it has to be inside `RouterProvider`; and it marks the whole body inert and portals past the app, so it belongs above `Layout` rather than in it.
- **It owns the startup sweep too**, not `__root.tsx`. The sweep and the seed read and write the same `meta` list (`src/lib/tour/props.ts`), and running them from two components races a fresh seed against the old list's purge.
- The startup effect reads the Props once via `readProps(store)`, then sweeps and auto-starts (`!onboardingSeenAt && on the Feed`) once the Feed has actually painted (a `waitFor` on the `capture` target - also what keeps the Tour out of every jsdom test that renders a route). **The ref guard that stops it running twice is only set once that read lands**, not before: Preferences (and now Props) are read eagerly on mount, so this effect's first run is the initial mount, which React StrictMode double-invokes in dev - marking the guard up front let the first invocation's continuation get cancelled by its own cleanup while the guard silently blocked the second, real invocation from ever running it.
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
