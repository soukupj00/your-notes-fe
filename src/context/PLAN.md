# PLAN - `src/context`

What is left at the provider layer.
Milestones and tickets are in the [root PLAN.md](../../PLAN.md).

- A high-contrast or low-vision palette, driven from the OKLCH tokens in `src/styles/globals.css`.
  The colour-blind palette, density and reduced motion have shipped.
- After the user test: fold theme, view mode and sidebar state into `PreferencesProvider`, with one provider stack shared with the test renderer (root PLAN.md, M6).
