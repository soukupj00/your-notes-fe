# CLAUDE.md — `src/context` (React providers)

App-wide React context providers. See [`PLAN.md`](./PLAN.md) for upcoming work.

## `NotesProvider.tsx`

Holds the app-wide search text and nothing else.

- State: `query` (search string), exposed as `{ query, setQuery }` via `useNotes()`.
- The search box lives in the `Navbar`, above the router outlet, so the query cannot belong to any single view. The note **list**, however, does: each route calls `useNoteFeed(scope, query)` with its own scope (`/` → active, `/archive` → archived, `/trash` → trashed, `/tag/$id` → active + tag). That is why this provider no longer queries notes.
- `useNotes()` throws if used outside the provider.
- Wrapped around the router in `App.tsx`.

> Note: there is also a standalone `useNotes()` **hook** in `src/hooks/data/useNotes.ts` (returns all notes). Don't confuse the two.

## `themeProvider.tsx`

Custom theme provider (**not** `next-themes`, even though that package is installed).

- Theme type: `'dark' | 'light' | 'system'`.
- Persists the choice to `localStorage` under `storageKey` (default `vite-ui-theme`); `App.tsx` uses `defaultTheme="dark"`.
- On change, toggles the `light`/`dark` class on `document.documentElement`; `system` resolves via `window.matchMedia('(prefers-color-scheme: dark)')`.
- Exposes `{ theme, setTheme }` via the `useTheme()` hook (throws outside the provider).
- The actual color values are the OKLCH tokens in `src/themes.ts`.
