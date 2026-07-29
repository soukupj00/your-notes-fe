# CLAUDE.md — `src/context` (React providers)

App-wide React context providers. See [`PLAN.md`](./PLAN.md) for upcoming work.

> **`NotesProvider` is gone** (M4 Slice 2). The app-wide search text it held now lives in the URL as typed TanStack search params, read and written through `useNoteSearchState()` (`src/hooks/useNoteSearchState.ts`); the feed itself is `useNoteFeed(scope, search)` per route.
> A context would have made the same state unshareable and invisible to the back button.
> Note the standalone `useNotes()` **hook** in `src/hooks/data/useNotes.ts` (returns all notes) is unrelated and still there.

## `PreferencesProvider.tsx`

User preferences, persisted as one Zod-validated blob in the Dexie `settings` store under the key `preferences`.

- Dexie rather than `localStorage` on purpose: it is the store M5 will sync, and it rides along in the same export/import backup as the notes.
- `preferencesSchema` owns the shape and every default; `PREFERENCES_VERSION` versions the blob independently of the Dexie schema, so a new preference is a code-only change.
- **Anything unreadable yields defaults** — corrupt value, invalid field, or an unknown `version`. A failed read deliberately leaves the bad blob on disk (the next write replaces it) so a read can never destroy data.
- Hydration is async: `useLiveQuery` returns nothing on the first render, so children see `DEFAULT_PREFERENCES` and re-render when the blob lands. `hydrated` is exposed for the consumers that must not act before then (the onboarding tour).
- `setPreference(key, value)` does a read-modify-write inside a `rw` transaction, so two writes to different keys can't clobber each other, and re-stamps the current `version`.
- `usePreferences()` throws outside the provider.

> `ThemeProvider` and `ViewModeProvider` still use `localStorage`. Folding them into this store is a deliberate later consolidation (both are read synchronously on first paint, which this async store can't do without a flash).

## `themeProvider.tsx`

Custom theme provider (**not** `next-themes`, even though that package is installed).

- Theme type: `'dark' | 'light' | 'system'`.
- Persists the choice to `localStorage` under `storageKey` (default `vite-ui-theme`); `App.tsx` uses `defaultTheme="dark"`.
- On change, toggles the `light`/`dark` class on `document.documentElement`; `system` resolves via `window.matchMedia('(prefers-color-scheme: dark)')`.
- Exposes `{ theme, setTheme }` via the `useTheme()` hook (throws outside the provider).
- The actual color values are the OKLCH tokens in `src/themes.ts`.
