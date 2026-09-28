# PLAN — `src/context`

What's left at the provider layer. See [root PLAN.md](../../PLAN.md) for milestone context.

## Theming & accessibility (M4)

- Add accessibility theme variants beyond light/dark: the colour-blind palette has shipped (`colorBlind` preference, stamped as the `cvd` class by `DocumentPreferences`); low-vision/high-contrast is still open, driven from the OKLCH tokens in `src/styles/globals.css`.
- Decide whether the variant is a separate axis from light/dark (recommended: `mode` × `palette`) and reflect it in `themeProvider.tsx`.
- Ensure icons remain descriptive/recognizable per the accessibility goal in `INSTRUCTIONS.md`.

## Auth / accounts context (M5 slice 2)

The account half landed in M5 slice 3 as `AccountProvider.tsx` (see [CLAUDE.md](./CLAUDE.md)); `SyncProvider` is M5 slice 4.

- Add a provider for the **Local Account** (see [CONTEXT.md](../../CONTEXT.md)): signed-in state, the current Device, and sync status, consumed by the sync layer.
  There is **no token to hold**: the session is an `HttpOnly` cookie the browser sends and JavaScript cannot read ([ADR 0018](../../docs/adr/0018-the-server-serves-the-pwa.md)), so "am I signed in" is answered by asking the server once at startup, not by inspecting storage.
  There is also **no server URL to configure** - the server served this app, so its origin is the app's own.
- **`SyncProvider` is a separate provider from the account one**, and runs the loop on the main thread over the app's Local Store: poll on focus / `online` / visibility plus a short interval while visible, push dirty rows, pull the change feed from the stored cursor. Keep network logic out of components - expose it through this context plus the data hooks ([`src/hooks/data/PLAN.md`](../hooks/data/PLAN.md)).

## Tests

- Provider tests (Vitest + RTL): `useNotes()`/`useTheme()` throw outside their providers; `setQuery` switches `notes` between all-notes and search results; `setTheme` persists to `localStorage` and toggles the root class.
