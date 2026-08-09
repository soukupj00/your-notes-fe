# PLAN — `src/context`

What's left at the provider layer. See [root PLAN.md](../../PLAN.md) for milestone context.

## Theming & accessibility (M4)

- Add accessibility theme variants beyond light/dark: the colour-blind palette has shipped (`colorBlind` preference, stamped as the `cvd` class by `DocumentPreferences`); low-vision/high-contrast is still open, driven from the OKLCH tokens in `src/styles/globals.css`.
- Decide whether the variant is a separate axis from light/dark (recommended: `mode` × `palette`) and reflect it in `themeProvider.tsx`.
- Ensure icons remain descriptive/recognizable per the accessibility goal in `INSTRUCTIONS.md`.

## Auth / accounts context (M5)

- Add a provider for the **Local Account** (see [CONTEXT.md](../../CONTEXT.md)): login/create-local-account state, token, and sync status, consumed by the sync layer.
- Keep network/sync logic out of components — expose it through this context plus the data hooks ([`src/hooks/data/PLAN.md`](../hooks/data/PLAN.md)).

## Tests

- Provider tests (Vitest + RTL): `useNotes()`/`useTheme()` throw outside their providers; `setQuery` switches `notes` between all-notes and search results; `setTheme` persists to `localStorage` and toggles the root class.
