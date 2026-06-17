# CLAUDE.md — `src/context` (React providers)

App-wide React context providers. See [`PLAN.md`](./PLAN.md) for upcoming work.

## `NotesProvider.tsx`

Combines the global note list with search and exposes it via the `useNotes()` hook.

- State: `query` (search string).
- Reads: `useSearchNotes(query)` for results when `query` is non-empty; a live `db.notes.toArray()` query otherwise.
- Exposes `{ query, setQuery, notes }`. `notes` switches between search results and all notes based on whether `query.trim()` is set.
- `useNotes()` throws if used outside the provider.
- Wrapped around the app in `App.tsx`.

> Note: there is also a standalone `useNotes()` **hook** in `src/hooks/data/useNotes.ts` (returns all notes). The context's `useNotes()` is search-aware and is the one components should use for the list view. Don't confuse the two.

## `themeProvider.tsx`

Custom theme provider (**not** `next-themes`, even though that package is installed).

- Theme type: `'dark' | 'light' | 'system'`.
- Persists the choice to `localStorage` under `storageKey` (default `vite-ui-theme`); `App.tsx` uses `defaultTheme="dark"`.
- On change, toggles the `light`/`dark` class on `document.documentElement`; `system` resolves via `window.matchMedia('(prefers-color-scheme: dark)')`.
- Exposes `{ theme, setTheme }` via the `useTheme()` hook (throws outside the provider).
- The actual color values are the OKLCH tokens in `src/themes.ts`.
