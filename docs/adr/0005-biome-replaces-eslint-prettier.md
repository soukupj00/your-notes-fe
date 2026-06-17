# 0005 — Biome replaces ESLint + Prettier

- Status: Accepted
- Date: 2026-06-15

## Context

The project lints with ESLint 9 (flat config) and formats with Prettier + `prettier-plugin-tailwindcss`, run on commit via husky + lint-staged. Three problems:

- The commit hook only runs `prettier --write` — there is **no lint autofix** on commit, so style/lint consistency is not actually enforced hands-off.
- `eslint.config.ts` does not wire in `eslint-plugin-react-hooks` / `eslint-plugin-react-refresh` even though they are installed — the hooks rules aren't enforced.
- Two tools, multiple configs, and a slower pipeline.

The goal is automatic, hands-off style/lint consistency (especially on commit) with minimal tooling.

## Decision

Adopt **Biome** as the single lint **and** format tool, replacing both ESLint and Prettier. Biome is not paired with Prettier (they both format and would overlap).

- Config: a single `biome.json` (recommended rules + `organizeImports` + formatter).
- Tailwind class sorting moves to Biome's nursery `useSortedClasses`, configured for `className` and the `cn`/`clsx`/`cva` helpers.
- Pre-commit (husky + lint-staged) runs `biome check --write` on staged files: applies **safe** fixes (formatting, import sorting, safe lint fixes) and re-stages them; remaining errors block the commit. **Unsafe** fixes are never auto-applied (they can change behavior) — they surface in CI / manual runs.
- CI runs `biome ci .` as a non-mutating gate.
- Removed: `eslint`, `typescript-eslint`, all `eslint-plugin-*`, `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss`, `eslint.config.ts`, and the lint-staged Prettier entry.

## Consequences

- One fast tool, one config, one CI command; lint autofix now actually runs on commit, and React hooks rules are enforced by Biome (`useExhaustiveDependencies`, `useHookAtTopLevel`).
- **Trade-off:** Biome's `useSortedClasses` is nursery-stage and less complete than `prettier-plugin-tailwindcss` (notably around Tailwind v4) — class sorting may be imperfect. Accepted in exchange for tool consolidation.
- Biome does **not** format Markdown or YAML; those files are simply left unformatted.
- Reversible but non-trivial: returning to ESLint/Prettier means restoring configs and dependencies. This is why it's recorded here.
